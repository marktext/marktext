import { ref, watch } from 'vue'
import { defineStore } from 'pinia'
import { addFile, unlinkFile, addDirectory, unlinkDirectory, resortTree, updateFileMtime } from './treeCtrl'
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
    // Root directory such as "/" or "C:\"
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

interface BufferedProjectState {
  rootDirectory: string
}

const createBufferedProjectState = (state: unknown): BufferedProjectState => {
  const s = (state || {}) as { rootDirectory?: string; projectTree?: { pathname?: string } }
  return {
    rootDirectory: normalizeProjectRoot(s.rootDirectory || s.projectTree?.pathname)
  }
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

interface PendingEvent {
  type: string
  change: TreeChange
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
  const projectTree = ref<ProjectTree | null>(null)
  const pendingTreeEvents = ref<PendingEvent[]>([])

  const preferencesStore = usePreferencesStore()

  watch(
    [() => preferencesStore.fileSortBy, () => preferencesStore.fileSortOrder],
    ([sortBy, sortOrder]) => {
      if (projectTree.value) {
        resortTree(projectTree.value, String(sortBy), String(sortOrder))
      }
    }
  )

  function OPEN_PROJECT(
    pathname: string,
    { scheduleBufferUpdate = true }: OpenProjectOptions = {}
  ): void {
    const layoutStore = useLayoutStore()
    const tree = createProjectRoot(pathname)
    if (!tree) return

    projectTree.value = tree
    // The old tree's selection and in-progress name inputs do not survive a new root.
    activeItem.value = {}
    CLEAR_NAME_INPUT_STATE()

    const layout = {
      rightColumn: 'files',
      showSideBar: true,
      showTabBar: true
    }
    layoutStore.SET_LAYOUT(layout, { scheduleBufferUpdate })
    layoutStore.DISPATCH_LAYOUT_MENU_ITEMS()

    // Process pending events that arrived before projectTree was initialized.
    for (const event of pendingTreeEvents.value) {
      _processTreeEvent(event.type, event.change)
    }
    pendingTreeEvents.value = []

    if (scheduleBufferUpdate) {
      debouncedSendBufferedState()
    }
  }

  function CREATE_BUFFERED_STATE(): BufferedProjectState {
    return createBufferedProjectState({
      projectTree: projectTree.value
    })
  }

  function RESTORE_BUFFERED_STATE(state: unknown): void {
    const { rootDirectory } = createBufferedProjectState(state)
    if (rootDirectory) {
      if (projectTree.value?.pathname === rootDirectory) return
      OPEN_PROJECT(rootDirectory, { scheduleBufferUpdate: false })
    } else {
      projectTree.value = null
      pendingTreeEvents.value = []
      activeItem.value = {}
      CLEAR_NAME_INPUT_STATE()
    }
  }

  function LISTEN_FOR_LOAD_PROJECT(): void {
    window.electron.ipcRenderer.on('mt::open-directory', (_e, pathname) => {
      OPEN_PROJECT(String(pathname))
    })
  }

  function LISTEN_FOR_UPDATE_PROJECT(): void {
    window.electron.ipcRenderer.on('mt::update-object-tree', (_e, payload) => {
      const { type, change } = (payload as { type: string; change: TreeChange }) ?? {}
      if (!projectTree.value) {
        pendingTreeEvents.value.push({ type, change })
        return
      }
      _processTreeEvent(type, change)
    })
  }

  function _processTreeEvent(type: string, change: TreeChange): void {
    const editorStore = useEditorStore()
    switch (type) {
      case 'add': {
        const { pathname, data, isMarkdown } = change
        addFile(projectTree.value!, change as Parameters<typeof addFile>[1], String(preferencesStore.fileSortBy), String(preferencesStore.fileSortOrder))
        if (isMarkdown && newFileNameCache.value && pathname === newFileNameCache.value) {
          const fileState = getFileStateFromData(data as Record<string, unknown>)
          editorStore.UPDATE_CURRENT_FILE(fileState)
          newFileNameCache.value = ''
        }
        break
      }
      case 'unlink':
        unlinkFile(projectTree.value!, change)
        editorStore.SET_SAVE_STATUS_WHEN_REMOVE(change)
        break
      case 'addDir':
        addDirectory(projectTree.value!, change)
        break
      case 'unlinkDir':
        unlinkDirectory(projectTree.value!, change)
        break
      case 'change':
        if (change?.mtimeMs !== undefined) {
          updateFileMtime(projectTree.value!, change as Parameters<typeof updateFileMtime>[1], String(preferencesStore.fileSortBy), String(preferencesStore.fileSortOrder))
        }
        break
      default:
        if (window.electron?.process?.env?.NODE_ENV === 'development') {
          console.log(`Unknown directory watch type: "${type}"`)
        }
        break
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function CHANGE_ACTIVE_ITEM(item: any): void {
    activeItem.value = item
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
  }

  function ASK_FOR_OPEN_PROJECT(): void {
    window.electron.ipcRenderer.send('mt::ask-for-open-project-in-sidebar')
  }

  function LISTEN_FOR_SIDEBAR_CONTEXT_MENU(): void {
    bus.on('SIDEBAR::show-in-folder', () => {
      const { pathname } = activeItem.value
      window.electron.shell.showItemInFolder(pathname)
    })
    bus.on('SIDEBAR::new', (type: unknown) => {
      const { pathname, isDirectory } = activeItem.value
      const dirname = isDirectory ? pathname : window.path.dirname(pathname)
      createCache.value = { dirname, type: String(type) }
      nameInputValue.value = ''
      bus.emit('SIDEBAR::show-new-input')
    })
    bus.on('SIDEBAR::remove', async() => {
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
    bus.on('SIDEBAR::copy-cut', (type: unknown) => {
      const { pathname: src } = activeItem.value
      clipboard.value = { type: String(type), src }
    })
    bus.on('SIDEBAR::paste', async() => {
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
    bus.on('SIDEBAR::rename', () => {
      const { pathname } = activeItem.value
      renameCache.value = pathname
      nameInputValue.value = typeof pathname === 'string' ? window.path.basename(pathname) : ''
      bus.emit('SIDEBAR::show-rename-input')
    })
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

    const fullName = `${dirname}/${name}`

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
    pendingTreeEvents,
    OPEN_PROJECT,
    CREATE_BUFFERED_STATE,
    RESTORE_BUFFERED_STATE,
    LISTEN_FOR_LOAD_PROJECT,
    LISTEN_FOR_UPDATE_PROJECT,
    CHANGE_ACTIVE_ITEM,
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
