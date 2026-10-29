import path from 'node:path'
import fs from 'fs-extra'
import { dialog, type BrowserWindow } from 'electron'
import type { SidebarMoveRequest, SidebarMoveResult } from '@shared/types/project'
import { t } from '../i18n'
import { containsPath } from 'common/filesystem/paths'

/** Validates real disk locations; moving a directory preserves its contents without following links. */
export const prepareSidebarMove = async(root: string, request: SidebarMoveRequest) => {
  const { source, targetDirectory } = request
  if (![root, source, targetDirectory].every(value => typeof value === 'string' && path.isAbsolute(value))) {
    throw new Error(t('sideBar.move.invalidTarget'))
  }
  const [realRoot, realSource, realTarget, sourceStat, targetStat] = await Promise.all([
    fs.realpath(root), fs.realpath(source), fs.realpath(targetDirectory),
    fs.lstat(source), fs.lstat(targetDirectory)
  ])
  // Comparing relative paths permits an aliased workspace root, but rejects links below it.
  const linkedPath = sourceStat.isSymbolicLink() || targetStat.isSymbolicLink() ||
    path.relative(root, source) !== path.relative(realRoot, realSource) ||
    path.relative(root, targetDirectory) !== path.relative(realRoot, realTarget)
  const outsideRoot = !containsPath(realRoot, realSource) || !containsPath(realRoot, realTarget)
  const invalidSource = path.relative(realRoot, realSource) === '' ||
    (!sourceStat.isDirectory() && !sourceStat.isFile())
  const invalidTarget = !targetStat.isDirectory() || containsPath(realSource, realTarget) ||
    path.relative(path.dirname(realSource), realTarget) === ''
  if (linkedPath || outsideRoot || invalidSource || invalidTarget) {
    throw new Error(t('sideBar.move.invalidTarget'))
  }
  if (sourceStat.dev !== targetStat.dev) throw new Error(t('sideBar.move.crossDevice'))
  const destination = path.join(realTarget, path.basename(source))
  try {
    await fs.lstat(destination)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return { source: realSource, destination, isDirectory: sourceStat.isDirectory(), device: sourceStat.dev, inode: sourceStat.ino }
    }
    throw error
  }
  throw new Error(t('sideBar.move.conflict'))
}

interface SidebarMoveOperations {
  root: string
  checkAvailable(source: string, destination: string): void
  move(source: string, destination: string, write: () => Promise<void>): Promise<void>
}

/** Confirmation precedes all writes; validation repeats inside the coordinated document operation. */
export const confirmAndMoveSidebarItem = async(
  win: BrowserWindow,
  request: SidebarMoveRequest,
  operations: SidebarMoveOperations
): Promise<SidebarMoveResult> => {
  try {
    const prepared = await prepareSidebarMove(operations.root, request)
    operations.checkAvailable(prepared.source, prepared.destination)
    const { response } = await dialog.showMessageBox(win, {
      type: 'question',
      buttons: [t('sideBar.move.confirm'), t('dialog.cancel')],
      defaultId: 1,
      cancelId: 1,
      noLink: true,
      message: t('sideBar.move.question', { name: path.basename(request.source) }),
      detail: t('sideBar.move.detail', { source: request.source, destination: prepared.destination }) +
        (prepared.isDirectory ? `\n${t('sideBar.move.directoryContents')}` : '')
    })
    if (response !== 0) return { status: 'canceled' }
    await operations.move(prepared.source, prepared.destination, async() => {
      const checked = await prepareSidebarMove(operations.root, request)
      if (checked.source !== prepared.source || checked.destination !== prepared.destination ||
        checked.device !== prepared.device || checked.inode !== prepared.inode) {
        throw new Error(t('sideBar.move.invalidTarget'))
      }
      operations.checkAvailable(checked.source, checked.destination)
      await fs.move(checked.source, checked.destination, { overwrite: false })
    })
    return { status: 'moved', destination: prepared.destination }
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code
    const message = code === 'ENOENT' ? t('sideBar.move.missing')
      : code === 'EACCES' || code === 'EPERM' ? t('sideBar.move.permission')
        : code === 'EEXIST' ? t('sideBar.move.conflict')
          : error instanceof Error ? error.message : String(error)
    return { status: 'failed', message }
  }
}
