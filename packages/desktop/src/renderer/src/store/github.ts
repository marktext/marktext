import { ref } from 'vue'
import { defineStore } from 'pinia'
import { useEditorStore } from '@/store/editor'
import type { GitHubChangeInfo, GitHubRepoInfo, GitHubSyncResult } from '@shared/types/ipc'

export const useGithubStore = defineStore('github', () => {
  const signedIn = ref(false)
  const username = ref<string | undefined>(undefined)
  const repoPath = ref<string | null>(null)
  const changes = ref<GitHubChangeInfo[]>([])
  const repos = ref<GitHubRepoInfo[]>([])
  const ahead = ref(0)
  const behind = ref(0)
  const conflictFiles = ref<string[]>([])
  const lfsWarning = ref(false)
  const busy = ref(false)
  // Last device-flow failure pushed from main (expired/denied code, network).
  const authError = ref<string | null>(null)

  const refreshAuth = async(): Promise<void> => {
    const status = await window.github.authStatus()
    signedIn.value = status.signedIn
    username.value = status.username
  }

  const startAuth = async(): Promise<{ userCode: string; verificationUri: string }> => {
    authError.value = null
    const info = await window.github.authStart()
    window.electron.shell.openExternal(info.verificationUri)
    return info
  }

  const signOut = async(): Promise<void> => {
    await window.github.signOut()
    signedIn.value = false
    username.value = undefined
  }

  const loadRepos = async(): Promise<void> => {
    repos.value = await window.github.listRepos()
  }

  const cloneRepo = async(cloneUrl: string, targetDir: string): Promise<string> => {
    busy.value = true
    try {
      const { localPath } = await window.github.clone(cloneUrl, targetDir)
      return localPath
    } finally {
      busy.value = false
    }
  }

  const refreshStatus = async(): Promise<void> => {
    if (!repoPath.value) {
      changes.value = []
      return
    }
    changes.value = await window.github.status(repoPath.value)
  }

  const setRepo = async(path: string | null): Promise<void> => {
    repoPath.value = path
    // isomorphic-git has no LFS support — warn when the repo uses it.
    lfsWarning.value = path ? await window.github.lfsCheck(path) : false
    await refreshStatus()
  }

  // Called whenever the opened project root changes: the panel serves any
  // git repo with a github.com origin, not only repos cloned through
  // MarkText (spec: UX flow step 3).
  const detectRepoForFolder = async(rootPath: string | null): Promise<void> => {
    if (!rootPath) {
      await setRepo(null)
      return
    }
    const info = await window.github.repoInfo(rootPath)
    await setRepo(info.isRepo ? rootPath : null)
  }

  // statusMatrix walks the whole tree — debounce watcher-driven bursts
  // instead of refreshing once per fs event.
  let statusTimer: ReturnType<typeof setTimeout> | null = null
  const scheduleRefresh = (): void => {
    if (statusTimer) clearTimeout(statusTimer)
    statusTimer = setTimeout(() => {
      statusTimer = null
      refreshStatus().catch(() => {})
    }, 300)
  }

  const stage = async(files: string[]): Promise<void> => {
    if (!repoPath.value) return
    changes.value = await window.github.stage(repoPath.value, files)
  }

  const unstage = async(files: string[]): Promise<void> => {
    if (!repoPath.value) return
    changes.value = await window.github.unstage(repoPath.value, files)
  }

  const commit = async(message: string): Promise<void> => {
    if (!repoPath.value) return
    await window.github.commit(repoPath.value, message)
    await refreshStatus()
  }

  // ASK_FOR_SAVE_ALL is a fire-and-forget IPC send: poll the editor's tab
  // state until every tab under the repo reports saved, or give up after the
  // timeout. Without this wait, main's dirty check can race the async writes
  // and a stale buffer save could clobber pulled changes after the merge.
  const SAVE_SETTLE_TIMEOUT = 5000
  const SAVE_POLL_INTERVAL = 100
  const unsavedRepoTabs = (
    tabs: Array<{ pathname: string | null; isSaved: boolean }>,
    root: string
  ): boolean => tabs.some((t) => !t.isSaved && !!t.pathname && t.pathname.startsWith(root))

  const waitForRepoSaves = async(
    editorStore: { tabs: Array<{ pathname: string | null; isSaved: boolean }> },
    root: string
  ): Promise<boolean> => {
    const deadline = Date.now() + SAVE_SETTLE_TIMEOUT
    while (unsavedRepoTabs(editorStore.tabs, root)) {
      if (Date.now() >= deadline) return false
      await new Promise((resolve) => setTimeout(resolve, SAVE_POLL_INTERVAL))
    }
    return true
  }

  const sync = async(): Promise<GitHubSyncResult | null> => {
    if (!repoPath.value) return null
    busy.value = true
    try {
      // Spec: Sync preconditions. Save all open tabs first — a pull may
      // rewrite files that are open in the editor, and an unsaved buffer
      // would clobber the pulled content on its next save. Main additionally
      // re-verifies a clean tree and returns { dirty: true } otherwise.
      const editorStore = useEditorStore()
      editorStore.ASK_FOR_SAVE_ALL(false)
      const settled = await waitForRepoSaves(editorStore, repoPath.value)
      if (!settled) {
        // Saves didn't land in time — refuse rather than race the merge.
        return {
          conflict: false,
          dirty: true,
          files: [],
          ahead: ahead.value,
          behind: behind.value
        }
      }
      const result = await window.github.sync(repoPath.value)
      ahead.value = result.ahead
      behind.value = result.behind
      conflictFiles.value = result.conflict ? result.files : []
      await refreshStatus()
      return result
    } finally {
      busy.value = false
    }
  }

  // Wire push events once at store creation.
  window.github.onAuthSuccess((status) => {
    signedIn.value = status.signedIn
    username.value = status.username
    authError.value = null
    loadRepos().catch(() => {})
  })
  window.github.onAuthError((message) => {
    authError.value = message
  })
  window.github.onStatusChanged((changed) => {
    if (changed === repoPath.value) scheduleRefresh()
  })
  // Refresh the change list when repo files change on disk (editor saves or
  // external edits) — our own git ops broadcast status-changed separately,
  // but ordinary file writes only surface through these push events.
  window.electron.ipcRenderer.on('mt::update-file', () => {
    if (repoPath.value) scheduleRefresh()
  })
  window.electron.ipcRenderer.on('mt::tab-saved', () => {
    if (repoPath.value) scheduleRefresh()
  })

  return {
    signedIn,
    username,
    repoPath,
    changes,
    repos,
    ahead,
    behind,
    conflictFiles,
    lfsWarning,
    busy,
    authError,
    refreshAuth,
    startAuth,
    signOut,
    loadRepos,
    cloneRepo,
    setRepo,
    detectRepoForFolder,
    refreshStatus,
    scheduleRefresh,
    stage,
    unstage,
    commit,
    sync
  }
})
