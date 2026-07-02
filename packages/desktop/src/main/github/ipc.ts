import { ipcMain, BrowserWindow, dialog } from 'electron'
import log from 'electron-log'
import path from 'path'
import * as gitOps from './git'
import * as auth from './auth'
import * as api from './api'

// Commit identity comes from the GitHub profile (noreply email) — MarkText
// has no git identity of its own (spec: Commit identity). The persisted
// identity keeps commit working offline; the network fetch is only a
// fallback for tokens stored before identity persistence existed.
let cachedAuthor: gitOps.GitAuthor | null = null
const author = async(): Promise<gitOps.GitAuthor> => {
  if (cachedAuthor) return cachedAuthor
  const identity = await auth.loadIdentity()
  if (identity) {
    cachedAuthor = api.commitAuthorFor(identity)
    return cachedAuthor
  }
  const token = await auth.getToken()
  if (!token) throw new Error('Not authenticated with GitHub')
  const user = await api.getUser(token)
  await auth.saveIdentity(user)
  cachedAuthor = api.commitAuthorFor(user)
  return cachedAuthor
}

const senderWindow = (e: Electron.IpcMainInvokeEvent): BrowserWindow | null =>
  BrowserWindow.fromWebContents(e.sender)

// status-changed is broadcast: two windows can have the same repo open and
// each window's store filters by its own repoPath. Auth + clone-progress
// events target only the initiating window.
const broadcastStatusChanged = (repoPath: string): void => {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send('mt::github::status-changed', repoPath)
  }
}

export const registerGitHubHandlers = (): void => {
  ipcMain.handle('mt::github::auth-status', async() => {
    // Offline-friendly (spec: IPC contract): token presence = signed in, no
    // network round-trip. Token validity surfaces lazily when a network op
    // fails with 401.
    const token = await auth.getToken()
    if (!token) return { signedIn: false }
    const identity = await auth.loadIdentity()
    return { signedIn: true, username: identity?.login }
  })

  ipcMain.handle('mt::github::auth-start', async(e) => {
    const info = await auth.requestDeviceCode()
    const win = senderWindow(e)
    // Poll in the background; notify the renderer when it resolves.
    auth
      .pollForToken(info.deviceCode, info.interval)
      .then(async(token) => {
        const user = await api.getUser(token)
        await auth.saveIdentity(user)
        cachedAuthor = api.commitAuthorFor(user)
        win?.webContents.send('mt::github::auth-success', { signedIn: true, username: user.login })
      })
      .catch((err) => {
        log.error('GitHub auth failed:', err)
        win?.webContents.send('mt::github::auth-error', String(err?.message ?? err))
      })
    return {
      userCode: info.userCode,
      verificationUri: info.verificationUri,
      expiresIn: info.expiresIn,
      interval: info.interval
    }
  })

  ipcMain.handle('mt::github::sign-out', () => {
    cachedAuthor = null
    return auth.signOut()
  })

  ipcMain.handle('mt::github::repo-info', (_e, repoPath: string) => gitOps.detectRepo(repoPath))

  ipcMain.handle('mt::github::lfs-check', (_e, repoPath: string) => gitOps.hasLfsPatterns(repoPath))

  ipcMain.handle('mt::github::list-repos', async() => {
    const token = await auth.getToken()
    if (!token) throw new Error('Not authenticated with GitHub')
    return api.listRepos(token)
  })

  // Native directory picker for the clone target — the sandboxed renderer
  // cannot open a dialog itself (spec: UX flow step 2).
  ipcMain.handle('mt::github::choose-dir', async(e) => {
    const win = senderWindow(e)
    if (!win) return null
    const { canceled, filePaths } = await dialog.showOpenDialog(win, {
      properties: ['openDirectory', 'createDirectory']
    })
    return canceled || !filePaths[0] ? null : filePaths[0]
  })

  ipcMain.handle('mt::github::clone', async(e, cloneUrl: string, targetDir: string) => {
    const repoName = path.basename(cloneUrl).replace(/\.git$/, '')
    const localPath = path.join(targetDir, repoName)
    const win = senderWindow(e)
    // isomorphic-git fires onProgress extremely often — throttle the IPC
    // forwarding (spec: IPC contract).
    let lastProgress = 0
    await gitOps.cloneRepo(cloneUrl, localPath, auth.getToken, (p) => {
      const now = Date.now()
      if (now - lastProgress < 100 && p.loaded !== p.total) return
      lastProgress = now
      win?.webContents.send('mt::github::clone-progress', p)
    })
    // Open the freshly cloned folder in the requesting window through the
    // existing folder-open path (spec: reuse the open-folder machinery).
    if (win) ipcMain.emit('app-open-directory-by-id', win.id, localPath, true)
    return { localPath }
  })

  // Every git operation goes through the per-repo queue (spec: Concurrency):
  // isomorphic-git has no index.lock, so two windows — or a watcher-driven
  // status racing a commit — could otherwise corrupt the index.
  ipcMain.handle('mt::github::status', (_e, repoPath: string) =>
    gitOps.withRepoQueue(repoPath, () => gitOps.listChanges(repoPath))
  )

  ipcMain.handle('mt::github::stage', (_e, repoPath: string, files: string[]) =>
    gitOps.withRepoQueue(repoPath, async() => {
      await gitOps.stage(repoPath, files)
      broadcastStatusChanged(repoPath)
      return gitOps.listChanges(repoPath)
    })
  )

  ipcMain.handle('mt::github::unstage', (_e, repoPath: string, files: string[]) =>
    gitOps.withRepoQueue(repoPath, async() => {
      await gitOps.unstage(repoPath, files)
      broadcastStatusChanged(repoPath)
      return gitOps.listChanges(repoPath)
    })
  )

  ipcMain.handle('mt::github::commit', (_e, repoPath: string, message: string) =>
    gitOps.withRepoQueue(repoPath, async() => {
      const oid = await gitOps.commit(repoPath, message, await author())
      broadcastStatusChanged(repoPath)
      return { oid }
    })
  )

  ipcMain.handle('mt::github::sync', (_e, repoPath: string) =>
    gitOps.withRepoQueue(repoPath, async() => {
      const result = await gitOps.sync(repoPath, auth.getToken, await author())
      broadcastStatusChanged(repoPath)
      return result
    })
  )
}
