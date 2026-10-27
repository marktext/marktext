import { computed, nextTick, onScopeDispose, ref, watch } from 'vue'
import { defineStore } from 'pinia'
import {
  addFile,
  unlinkFile,
  addDirectory,
  unlinkDirectory,
  resortTree,
  updateFileMtime,
  expandAncestors
} from './treeCtrl'
import { usePreferencesStore } from './preferences'
import bus from '../bus'
import { create, paste, rename, type FileCreateType, type PasteOptions } from '../util/fileSystem'
import { PATH_SEPARATOR } from '../config'
import notice from '../services/notification'
import { getFileStateFromData } from './help'
import { useLayoutStore } from './layout'
import { useEditorStore } from './editor'
import { debouncedSendBufferedState } from './bufferedState'
import type { TreeNode, TreeFolderNode } from '../components/sideBar/types'
import type { FileChangeDetail } from '@shared/types/files'
import {
  STATE_LIMITS,
  type ProjectViewState,
  type WorkspaceDescriptor
} from '@shared/types/applicationState'
import {
  readBufferedRoots,
  type BufferedProjectState,
  type ProjectRoot,
  type ProjectRootsSnapshot
} from '@shared/types/project'
import { t } from '../i18n'

type ProjectTree = TreeNode
type TreeChange = FileChangeDetail

const normalizeProjectRoot = (pathname: string | null | undefined): string => {
  return pathname ? window.path.normalize(pathname) : ''
}

const createProjectRoot = (pathname: string): ProjectTree | null => {
  const normalizedPathname = normalizeProjectRoot(pathname)
  if (!normalizedPathname) return null

  let name = window.path.basename(normalizedPathname)
  if (!name) {
    name = normalizedPathname
  }

  return {
    pathname: normalizedPathname,
    name,
    isDirectory: true,
    isFile: false,
    isMarkdown: false,
    folders: [],
    files: []
  }
}

export interface RootView extends ProjectRoot {
  tree: ProjectTree
  collapsedPaths: Set<string>
  restoring: boolean
}

const isWithinRoot = (root: string, pathname: string): boolean => {
  const relative = window.path.relative(root, pathname)
  return (
    relative === '' ||
    (relative !== '..' &&
      !relative.startsWith(`..${PATH_SEPARATOR}`) &&
      !window.path.isAbsolute(relative))
  )
}

const visitFolders = (tree: TreeFolderNode, visit: (folder: TreeFolderNode) => void): void => {
  visit(tree)
  for (const folder of tree.folders) visitFolders(folder, visit)
}

interface OpenProjectOptions {
  scheduleBufferUpdate?: boolean
}

interface CreateCacheEntry {
  dirname: string
  type: 'file' | 'directory' | string
}

interface ClipboardEntry {
  type: 'copy' | 'cut' | string
  src: string
  dest?: string
}

export const useProjectStore = defineStore('project', () => {
  // Heterogeneous UI state: assigned file nodes, folder nodes, and the empty
  // "no selection" object/null across sidebar components; a single non-`any`
  // union breaks both the assignments and the field reads, so it stays a hatch.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const activeItem = ref<any>({})
  const createCache = ref<CreateCacheEntry | Record<string, never>>({})
  const newFileNameCache = ref<string>('')
  const renameCache = ref<string | null>(null)
  // Text of whichever inline rename/create input is open. It lives here (not in
  // the row components) so the click-away handler can commit the edit.
  const nameInputValue = ref<string>('')
  const clipboard = ref<ClipboardEntry | null>(null)
  const restoringSession = ref(false)
  const roots = ref<RootView[]>([])
  const availableRoots = computed(() => roots.value.filter((root) => root.status === 'ready'))
  const projectTree = computed<ProjectTree | null>({
    get: () => {
      const currentFile = useEditorStore().currentFile
      if (currentFile)
        return currentFile.pathname ? (FIND_ROOT(currentFile.pathname)?.tree ?? null) : null
      return roots.value.length === 1 ? roots.value[0].tree : null
    },
    set: (tree) => {
      roots.value = tree
        ? [
          {
            key: tree.pathname,
            pathname: tree.pathname,
            watchToken: '',
            status: 'ready',
            tree,
            collapsedPaths: new Set<string>(),
            restoring: false
          }
        ]
        : []
    }
  })
  let revision = 0
  const treeVersion = ref(0)

  const preferencesStore = usePreferencesStore()

  watch(
    [() => preferencesStore.fileSortBy, () => preferencesStore.fileSortOrder],
    ([sortBy, sortOrder]) => {
      for (const root of roots.value) {
        resortTree(root.tree, String(sortBy), String(sortOrder))
      }
    }
  )

  function FIND_ROOT(pathname: string): RootView | undefined {
    return roots.value.find(
      (root) => isWithinRoot(root.pathname, pathname) || isWithinRoot(root.key, pathname)
    )
  }

  function ROOT_BASE(pathname: string): string | undefined {
    const root = FIND_ROOT(pathname)
    return root ? (isWithinRoot(root.pathname, pathname) ? root.pathname : root.key) : undefined
  }

  function TREE_PATH(pathname: string): string {
    const root = FIND_ROOT(pathname)
    const base = ROOT_BASE(pathname)
    return root && base && base !== root.pathname
      ? window.path.join(root.pathname, window.path.relative(base, pathname))
      : pathname
  }

  function GET_DEFAULT_DIRECTORY(): string {
    const selected =
      typeof activeItem.value?.pathname === 'string'
        ? FIND_ROOT(activeItem.value.pathname)
        : undefined
    if (selected?.status === 'ready') return selected.pathname
    return availableRoots.value.length === 1 ? availableRoots.value[0].pathname : ''
  }

  function ROOT_LABEL(root: RootView): string {
    const name = root.tree.name
    return roots.value.filter((item) => item.tree.name === name).length > 1
      ? `${name} — ${window.path.dirname(root.pathname)}`
      : name
  }

  function FILE_LABEL(pathname: string): string {
    const root = FIND_ROOT(pathname)
    const base = ROOT_BASE(pathname)
    return root && base ? `${ROOT_LABEL(root)} / ${window.path.relative(base, pathname)}` : pathname
  }

  function OPEN_PROJECT(
    pathname: string,
    { scheduleBufferUpdate = true }: OpenProjectOptions = {}
  ): void {
    projectTree.value = createProjectRoot(pathname)
    activeItem.value = {}
    CLEAR_NAME_INPUT_STATE()
    if (!useLayoutStore().managed) SHOW_FILES(scheduleBufferUpdate)
  }

  function SHOW_FILES(scheduleBufferUpdate = true): void {
    const layoutStore = useLayoutStore()
    layoutStore.SET_LAYOUT({ rightColumn: 'files', showSideBar: true }, { scheduleBufferUpdate })
    layoutStore.DISPATCH_LAYOUT_MENU_ITEMS()
    if (scheduleBufferUpdate) debouncedSendBufferedState()
  }

  function APPLY_ROOTS(snapshot: ProjectRootsSnapshot): void {
    if (snapshot.revision <= revision) return
    revision = snapshot.revision
    if (snapshot.reason === 'restore') restoringSession.value = true
    const removedIndex = roots.value.findIndex((root) => root.key === snapshot.targetKey)
    roots.value = snapshot.roots.map((root) => {
      const existing = roots.value.find(
        (item) => item.key === root.key && item.watchToken === root.watchToken
      )
      if (existing) {
        Object.assign(existing, root)
        if (root.status === 'ready') existing.restoring = false
        return existing
      }
      const previous = roots.value.find((item) => item.key === root.key)
      const collapsedPaths = new Set(previous ? collectCollapsed(previous) : [])
      const tree = createProjectRoot(root.pathname)!
      tree.isCollapsed = collapsedPaths.has('')
      return { ...root, tree, collapsedPaths, restoring: !!previous }
    })
    treeVersion.value++
    if (activeItem.value?.pathname && !FIND_ROOT(activeItem.value.pathname)) activeItem.value = {}
    if (snapshot.reason === 'replace' || snapshot.reason === 'remove') CLEAR_NAME_INPUT_STATE()
    if (['add', 'replace', 'reveal'].includes(snapshot.reason)) {
      if (!useLayoutStore().managed) SHOW_FILES()
      nextTick(() => bus.emit('SIDEBAR::focus-root', snapshot.targetKey))
      if (snapshot.reason === 'reveal')
        notice.notify({
          title: t('menu.file.addFolder'),
          type: 'info',
          message: t('sideBar.tree.folderAlreadyAdded')
        })
    }
    if (snapshot.reason === 'remove') {
      nextTick(() =>
        bus.emit(
          'SIDEBAR::focus-root',
          roots.value[Math.min(Math.max(removedIndex, 0), roots.value.length - 1)]?.key
        )
      )
    }
    if (snapshot.reason !== 'restore') debouncedSendBufferedState()
  }

  function collectCollapsed(root: RootView): string[] {
    const paths: string[] = []
    visitFolders(root.tree, (folder) => {
      if (folder.isCollapsed) paths.push(window.path.relative(root.pathname, folder.pathname))
    })
    return root.restoring || root.status === 'unavailable'
      ? [...new Set([...root.collapsedPaths, ...paths])]
      : paths
  }

  const safeCollapsedPaths = (paths: string[]): string[] =>
    [
      ...new Set(
        paths.filter(
          (relative) =>
            typeof relative === 'string' &&
            !/^(?:[A-Za-z]:|[\\/])/.test(relative) &&
            !relative.split(/[\\/]/).includes('..')
        )
      )
    ].slice(0, STATE_LIMITS.collapsedPathsPerRoot)

  const matchesWorkspaceRoot = (root: RootView, descriptor: WorkspaceDescriptor['roots'][number]): boolean =>
    window.path.normalize(root.key) === window.path.normalize(descriptor.location.canonicalPath) ||
    window.path.normalize(root.pathname) === window.path.normalize(descriptor.location.path)

  function CAPTURE_PROJECT_VIEW(workspace: WorkspaceDescriptor | null): ProjectViewState {
    return {
      roots: (workspace?.roots ?? []).map((descriptor) => {
        const root = roots.value.find(root => matchesWorkspaceRoot(root, descriptor))
        return {
          rootId: descriptor.id,
          collapsedPaths: root ? safeCollapsedPaths(collectCollapsed(root)) : []
        }
      })
    }
  }

  function RESTORE_PROJECT_VIEW(
    workspace: WorkspaceDescriptor | null,
    state: ProjectViewState
  ): void {
    for (const root of roots.value) {
      const descriptor = workspace?.roots.find(item => matchesWorkspaceRoot(root, item))
      const entry = descriptor
        ? state.roots.find((entry) => entry.rootId === descriptor.id)
        : undefined
      root.collapsedPaths = new Set(safeCollapsedPaths(entry?.collapsedPaths ?? []))
      root.restoring = true
      visitFolders(root.tree, (folder) => {
        folder.isCollapsed = root.collapsedPaths.has(
          window.path.relative(root.pathname, folder.pathname)
        )
      })
    }
    treeVersion.value++
  }

  function CREATE_BUFFERED_STATE(): BufferedProjectState {
    return {
      roots: roots.value.map((root) => ({
        pathname: root.pathname,
        collapsedPaths: collectCollapsed(root)
      }))
    }
  }

  function RESTORE_BUFFERED_STATE(state: unknown): void {
    const entries = readBufferedRoots(state)
    if (!roots.value.length) {
      roots.value = entries.map((entry) => ({
        key: entry.pathname,
        pathname: entry.pathname,
        watchToken: '',
        status: 'loading',
        tree: createProjectRoot(entry.pathname)!,
        collapsedPaths: new Set<string>(),
        restoring: true
      }))
    }
    for (const root of roots.value) {
      const entry = entries.find((item) => window.path.normalize(item.pathname) === root.pathname)
      root.collapsedPaths = new Set(entry?.collapsedPaths ?? [])
      root.restoring = true
      root.tree.isCollapsed = root.collapsedPaths.has('')
    }
    activeItem.value = {}
    CLEAR_NAME_INPUT_STATE()
    restoringSession.value = false
  }

  function LISTEN_FOR_LOAD_PROJECT(): void {
    window.electron.ipcRenderer.on('mt::project-roots-changed', (_e, snapshot) =>
      APPLY_ROOTS(snapshot)
    )
  }

  function LISTEN_FOR_UPDATE_PROJECT(): void {
    window.electron.ipcRenderer.on('mt::update-object-tree', (_e, payload) => {
      const { type, change, rootKey, watchToken } = payload
      const root = roots.value.find(
        (item) => item.key === rootKey && item.watchToken === watchToken
      )
      if (!root || !isWithinRoot(root.pathname, change.pathname)) return
      _processTreeEvent(root, type, change)
    })
  }

  function _processTreeEvent(root: RootView, type: string, change: TreeChange): void {
    const editorStore = useEditorStore()
    switch (type) {
      case 'add': {
        const { pathname, data, isMarkdown } = change
        addFile(
          root.tree,
          change as Parameters<typeof addFile>[1],
          String(preferencesStore.fileSortBy),
          String(preferencesStore.fileSortOrder)
        )
        if (isMarkdown && newFileNameCache.value && pathname === newFileNameCache.value) {
          const fileState = getFileStateFromData(data as Record<string, unknown>)
          editorStore.UPDATE_CURRENT_FILE(fileState)
          newFileNameCache.value = ''
        }
        break
      }
      case 'unlink':
        unlinkFile(root.tree, change)
        editorStore.SET_SAVE_STATUS_WHEN_REMOVE(change)
        break
      case 'addDir':
        addDirectory(root.tree, change)
        break
      case 'unlinkDir':
        unlinkDirectory(root.tree, change)
        break
      case 'change':
        if (change?.mtimeMs !== undefined) {
          updateFileMtime(
            root.tree,
            change as Parameters<typeof updateFileMtime>[1],
            String(preferencesStore.fileSortBy),
            String(preferencesStore.fileSortOrder)
          )
        }
        break
      default:
        if (window.electron?.process?.env?.NODE_ENV === 'development') {
          console.log(`Unknown directory watch type: "${type}"`)
        }
        break
    }

    // The mutations above are in place, so watchers need a counter to react to.
    if (root.restoring && (type === 'add' || type === 'addDir')) {
      const directory = type === 'addDir' ? change.pathname : window.path.dirname(change.pathname)
      const parts = window.path
        .relative(root.pathname, directory)
        .split(PATH_SEPARATOR)
        .filter(Boolean)
      let folder = root.tree
      for (const part of parts) {
        const child = folder.folders.find((item) => item.name === part)
        if (!child) break
        child.isCollapsed = root.collapsedPaths.has(
          window.path.relative(root.pathname, child.pathname)
        )
        folder = child
      }
    }
    treeVersion.value++
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function CHANGE_ACTIVE_ITEM(item: any): void {
    activeItem.value = item
  }

  /** Expands the folders leading to `pathname`; false when it is not in the tree. */
  function REVEAL_PATH(pathname: string | null | undefined): boolean {
    if (!pathname) return false
    const root = FIND_ROOT(pathname)
    if (!root) return false
    const expanded = expandAncestors(root.tree, TREE_PATH(pathname)) !== null
    if (expanded) debouncedSendBufferedState()
    return expanded
  }

  function REVEAL_FILE_IN_SIDE_BAR(pathname?: string | null): void {
    const editorStore = useEditorStore()
    const target = pathname ?? editorStore.currentFile?.pathname
    if (!target) return
    if (!FIND_ROOT(target)) {
      notice.notify({
        title: t('sideBar.icons.files'),
        type: 'info',
        message: t('sideBar.tree.fileOutsideFolders')
      })
      return
    }

    const layoutStore = useLayoutStore()
    layoutStore.SET_LAYOUT({ showSideBar: true, rightColumn: 'files' })
    // The tree mounts on the next flush, so the row cannot be found before it.
    nextTick(() => bus.emit('SIDEBAR::reveal-path', target))
  }

  function CHANGE_CLIPBOARD(data: ClipboardEntry | null): void {
    clipboard.value = data
  }

  // Rename and create share one "input is open" state, so they clear together.
  function CLEAR_NAME_INPUT_STATE(): void {
    createCache.value = {}
    renameCache.value = null
    nameInputValue.value = ''
  }

  // Clicking or blurring away accepts the edit, mirroring the Enter key and the
  // Finder / Windows Explorer gesture instead of discarding it (#3207, #3385).
  function COMMIT_NAME_INPUT(): void {
    const value = nameInputValue.value
    if (renameCache.value) {
      RENAME_IN_SIDEBAR(value)
      return
    }
    const { dirname } = createCache.value as CreateCacheEntry
    if (!dirname) return
    if (value) CREATE_FILE_DIRECTORY(value)
    else CLEAR_NAME_INPUT_STATE()
  }

  function SET_FOLDER_COLLAPSED(folder: TreeFolderNode, isCollapsed: boolean): void {
    folder.isCollapsed = isCollapsed
    const root = FIND_ROOT(folder.pathname)
    if (root) {
      const relative = window.path.relative(root.pathname, folder.pathname)
      root.collapsedPaths.delete(relative)
      if (isCollapsed) root.collapsedPaths.add(relative)
    }
    debouncedSendBufferedState()
  }

  function ASK_FOR_OPEN_PROJECT(): void {
    window.electron.ipcRenderer.send('mt::cmd-add-folder')
  }

  let stopSidebarContextMenu: (() => void) | null = null
  onScopeDispose(() => stopSidebarContextMenu?.())

  function LISTEN_FOR_SIDEBAR_CONTEXT_MENU(): () => void {
    // The store survives editor-page remounts, including Vue hot reloads.
    if (stopSidebarContextMenu) return stopSidebarContextMenu

    const unsubscribe: Array<() => void> = []
    const on = (event: string, handler: (value: unknown) => void): void => {
      bus.on(event, handler)
      unsubscribe.push(() => bus.off(event, handler))
    }
    on('SIDEBAR::show-in-folder', () => {
      const { pathname } = activeItem.value
      window.electron.shell.showItemInFolder(pathname)
    })
    on('SIDEBAR::copy-path', () => {
      const { pathname } = activeItem.value
      if (typeof pathname !== 'string' || !pathname) return
      window.electron.clipboard.writeText(pathname)
    })
    on('SIDEBAR::reveal-file', (pathname: unknown) => {
      REVEAL_FILE_IN_SIDE_BAR(typeof pathname === 'string' ? pathname : null)
    })
    on('SIDEBAR::new', (type: unknown) => {
      const { pathname, isDirectory } = activeItem.value
      const dirname = isDirectory ? pathname : window.path.dirname(pathname)
      createCache.value = { dirname, type: String(type) }
      nameInputValue.value = ''
      bus.emit('SIDEBAR::show-new-input')
    })
    on('SIDEBAR::remove', async() => {
      const { pathname } = activeItem.value
      if (typeof pathname !== 'string' || !pathname) return
      try {
        const trashed = await window.electron.ipcRenderer.invoke('mt::fs-trash-item', pathname)
        // The node is gone; drop the selection so Delete cannot retarget it.
        if (trashed && activeItem.value?.pathname === pathname) {
          activeItem.value = {}
        }
      } catch (err) {
        notice.notify({
          title: 'Error while deleting',
          type: 'error',
          message: err instanceof Error ? err.message : String(err)
        })
      }
    })
    on('SIDEBAR::copy-cut', (type: unknown) => {
      const { pathname: src } = activeItem.value
      clipboard.value = { type: String(type), src }
    })
    on('SIDEBAR::paste', async() => {
      const cb = clipboard.value
      const { pathname, isDirectory } = activeItem.value
      const dirname = isDirectory ? pathname : window.path.dirname(pathname)
      if (cb && cb.src) {
        let dest = dirname + PATH_SEPARATOR + window.path.basename(cb.src)

        if (window.path.normalize(cb.src) === window.path.normalize(dest)) {
          if (cb.type === 'cut') {
            notice.notify({
              title: 'Paste Forbidden',
              type: 'warning',
              message: 'Source and destination must not be the same.'
            })
            return
          }
          // Copy in same folder: generate unique name (e.g. "file (copy).md", "file (copy 2).md")
          const ext = window.path.extname(cb.src)
          const base = window.path.basename(cb.src, ext)
          let suffix = 1
          const MAX_COPIES = 99
          dest = dirname + PATH_SEPARATOR + base + ' (copy)' + ext
          while (await window.fileUtils.pathExists(dest)) {
            suffix++
            if (suffix > MAX_COPIES) {
              notice.notify({
                title: 'Too many copies',
                type: 'warning',
                message: `Maximum of ${MAX_COPIES} copies reached. Please clean up first.`
              })
              return
            }
            dest = dirname + PATH_SEPARATOR + base + ` (copy ${suffix})` + ext
          }
        }

        cb.dest = dest

        paste(cb as PasteOptions)
          .then(() => {
            clipboard.value = null
          })
          .catch((err) => {
            notice.notify({
              title: 'Error while pasting',
              type: 'error',
              message: err instanceof Error ? err.message : String(err)
            })
          })
      }
    })
    on('SIDEBAR::rename', () => {
      const { pathname } = activeItem.value
      renameCache.value = pathname
      nameInputValue.value = typeof pathname === 'string' ? window.path.basename(pathname) : ''
      bus.emit('SIDEBAR::show-rename-input')
    })
    stopSidebarContextMenu = () => {
      for (const off of unsubscribe) off()
      stopSidebarContextMenu = null
    }
    return stopSidebarContextMenu
  }

  async function CREATE_FILE_DIRECTORY(name: string): Promise<void> {
    const cache = createCache.value as CreateCacheEntry
    const { dirname, type } = cache
    // A second call after the input closed (or with no create target) is a no-op.
    if (!dirname) return
    // Close the input before the async work: a later click then sees no open
    // input and cannot submit the same edit twice.
    CLEAR_NAME_INPUT_STATE()

    if (type === 'file' && !window.fileUtils.hasMarkdownExtension(name)) {
      name += '.md'
    }

    const fullName = dirname + PATH_SEPARATOR + name

    try {
      // Creating over an existing path would silently overwrite it (outputFile
      // truncates). Refuse instead of destroying the existing file (#1946).
      if (await window.fileUtils.pathExists(fullName)) {
        notice.notify({
          title: 'Error in Side Bar',
          type: 'error',
          message: `A ${type} named "${name}" already exists in this folder.`
        })
        return
      }

      await create(fullName, type as FileCreateType)
      if (type === 'file') {
        newFileNameCache.value = fullName
      }
    } catch (err) {
      notice.notify({
        title: 'Error in Side Bar',
        type: 'error',
        message: err instanceof Error ? err.message : String(err)
      })
    }
  }

  function RENAME_IN_SIDEBAR(name: string): void {
    const editorStore = useEditorStore()
    const src = renameCache.value
    if (!src) return
    // Close the input before the async work: a later click then sees no open
    // input and cannot submit the same rename twice.
    CLEAR_NAME_INPUT_STATE()
    // An empty name would move the node onto its parent directory.
    if (!name) return
    const dirname = window.path.dirname(src)
    const dest = dirname + PATH_SEPARATOR + name
    if (window.path.normalize(dest) === window.path.normalize(src)) return
    rename(src, dest)
      .then(() => {
        // Keep the selection on the new path so a following F2 / Delete acts on
        // the renamed node instead of the one that no longer exists.
        if (activeItem.value?.pathname === src) {
          activeItem.value = {
            ...activeItem.value,
            pathname: dest,
            name: window.path.basename(dest)
          }
        }
        editorStore.RENAME_IF_NEEDED({ src, dest })
      })
      .catch((err) => {
        notice.notify({
          title: 'Error while renaming',
          type: 'error',
          message: err instanceof Error ? err.message : String(err)
        })
      })
  }

  function OPEN_SETTING_WINDOW(): void {
    window.electron.ipcRenderer.send('mt::open-setting-window')
  }

  return {
    activeItem,
    createCache,
    newFileNameCache,
    renameCache,
    nameInputValue,
    clipboard,
    projectTree,
    restoringSession,
    roots,
    availableRoots,
    FIND_ROOT,
    ROOT_BASE,
    TREE_PATH,
    GET_DEFAULT_DIRECTORY,
    ROOT_LABEL,
    FILE_LABEL,
    APPLY_ROOTS,
    treeVersion,
    OPEN_PROJECT,
    CAPTURE_PROJECT_VIEW,
    RESTORE_PROJECT_VIEW,
    CREATE_BUFFERED_STATE,
    RESTORE_BUFFERED_STATE,
    LISTEN_FOR_LOAD_PROJECT,
    LISTEN_FOR_UPDATE_PROJECT,
    CHANGE_ACTIVE_ITEM,
    REVEAL_PATH,
    REVEAL_FILE_IN_SIDE_BAR,
    CHANGE_CLIPBOARD,
    CLEAR_NAME_INPUT_STATE,
    COMMIT_NAME_INPUT,
    SET_FOLDER_COLLAPSED,
    ASK_FOR_OPEN_PROJECT,
    LISTEN_FOR_SIDEBAR_CONTEXT_MENU,
    CREATE_FILE_DIRECTORY,
    RENAME_IN_SIDEBAR,
    OPEN_SETTING_WINDOW
  }
})
