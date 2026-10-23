import bus from '../bus'
import { delay } from '@/util'
import FileSearcher from '@/node/fileSearcher'
import type { EditorState } from '@/store/editor'
import getCommandDescriptionById from './descriptions'
import notice from '@/services/notification'
import { t } from '../i18n'
import type { RecentDocument } from '@shared/types/ipc'

const SPECIAL_CHARS = /[\[\]\\^$.\|\?\*\+\(\)\/]{1}/g // eslint-disable-line no-useless-escape
const PATH_SEPARATOR = /[\\/]/

interface QuickOpenSubcommand {
  id: string
  description?: string
  title?: string
  group?: string
  removable?: boolean
}

interface FolderState {
  projectTree: { pathname: string } | null
  availableRoots?: { pathname: string }[]
  FILE_LABEL?: (pathname: string) => string
}
type RootState = { editor: EditorState; project: FolderState; [key: string]: unknown }

type CancelFn = (() => void) | null

class QuickOpenCommand {
  id: string
  description: string
  placeholder: string
  shortcut: string | null
  noResultsText: string
  subcommands: QuickOpenSubcommand[]
  subcommandSelectedIndex: number
  private _editorState: EditorState
  private _folderState: FolderState
  private _directorySearcher: FileSearcher
  private _cancelFn: CancelFn
  private _sequence = 0
  private _recentDocuments: RecentDocument[] = []
  private _recentPaths = new Set<string>()

  constructor(rootState: RootState) {
    this.id = 'file.quick-open'
    this.description = getCommandDescriptionById('file.quick-open')
    this.placeholder = t('commandPalette.placeholders.searchFileToOpen')
    this.shortcut = null
    this.noResultsText = t('commandPalette.noRecentFiles')

    this.subcommands = []
    this.subcommandSelectedIndex = -1

    this._editorState = rootState.editor
    this._folderState = rootState.project

    this._directorySearcher = new FileSearcher()
    this._cancelFn = null
  }

  search = async(query: string): Promise<QuickOpenSubcommand[]> => {
    const sequence = ++this._sequence
    this._cancelFn?.()
    this._cancelFn = null
    if (!query) return this.subcommands.map(item => ({ ...item, ...this._getPath(item.id) }))
    const timeout = delay(300)
    this._cancelFn = () => timeout.cancel()
    await timeout
    if (sequence !== this._sequence) throw new Error('')
    const result = await this._doSearch(query)
    if (sequence !== this._sequence) throw new Error('')
    return result
  }

  run = async(): Promise<void> => {
    const { _editorState } = this
    this.noResultsText = t('commandPalette.noRecentFiles')
    this._recentDocuments = await this._getRecentDocuments()
    this._recentPaths = new Set(this._recentDocuments.map((document) => document.pathname))

    if (
      !this._roots().length &&
      _editorState.tabs.length === 0 &&
      this._recentDocuments.length === 0
    ) {
      throw new Error(null as unknown as string)
    }

    this.subcommands = this._buildSubcommands()
  }

  execute = async(): Promise<void> => {
    // Timeout to hide the command palette and then show again to prevent issues.
    await delay(100)
    bus.emit('show-command-palette', this)
  }

  executeSubcommand = async(id: string): Promise<void> => {
    const { windowId } = window.marktext!.env!
    window.electron.ipcRenderer.send('mt::open-file-by-window-id', windowId, id)
  }

  removeItem = (id: string): void => {
    this.subcommands = this.subcommands.filter((item) => item.id !== id)
    this._recentDocuments = this._recentDocuments.filter((document) => document.pathname !== id)
    this._recentPaths.delete(id)
    window.electron.ipcRenderer.send('mt::remove-recently-used-document', id)
  }

  unload = (): void => {
    this._sequence++
    this._cancelFn?.()
    this._cancelFn = null
    this.subcommands = []
    this._recentDocuments = []
    this._recentPaths.clear()
  }

  _roots = (): string[] => this._folderState.availableRoots?.map(root => root.pathname)
    ?? (this._folderState.projectTree ? [this._folderState.projectTree.pathname] : [])

  private _getRecentDocuments = async(): Promise<RecentDocument[]> => {
    try {
      const documents = await window.electron.ipcRenderer.invoke('mt::get-recently-used-documents')
      return documents.filter((document) => !document.isDirectory)
    } catch {
      return []
    }
  }

  private _buildSubcommands = (): QuickOpenSubcommand[] => {
    const group = t('commandPalette.recentlyOpened')
    const items: QuickOpenSubcommand[] = []
    const seen = new Set<string>()

    const push = (pathname: string, removable: boolean): void => {
      if (!pathname || seen.has(pathname)) return
      seen.add(pathname)
      items.push({
        id: pathname,
        group,
        ...(removable ? { removable: true } : {}),
        ...this._getPath(pathname)
      })
    }

    this._recentDocuments.forEach((document) => push(document.pathname, true))
    this._editorState.tabs.forEach((tab) => {
      if (tab.pathname) push(tab.pathname, this._recentPaths.has(tab.pathname))
    })

    return items
  }

  _doSearch = (query: string): QuickOpenSubcommand[] | Promise<QuickOpenSubcommand[]> => {
    this._cancelFn = null
    const { _editorState } = this
    const sequence = this._sequence
    const rootPaths = this._roots()
    const isRootDirOpened = !!rootPaths.length
    const recentGroup = t('commandPalette.recentlyOpened')
    const fileGroup = t('commandPalette.fileResults')
    const re = this._createRegex(query)
    const matchPath = PATH_SEPARATOR.test(query)
    const items: QuickOpenSubcommand[] = []
    const seen = new Set<string>()
    const pathMatches: Array<{ pathname: string; removable: boolean }> = []

    const push = (pathname: string, group: string, removable: boolean): void => {
      if (!pathname || seen.has(pathname)) return
      seen.add(pathname)
      items.push({
        id: pathname,
        group,
        ...(removable ? { removable: true } : {}),
        ...this._getPath(pathname)
      })
    }

    const addRecentMatch = (pathname: string, removable: boolean): void => {
      if (matchPath) {
        if (re.test(pathname)) push(pathname, recentGroup, removable)
      } else if (re.test(window.path.basename(pathname))) {
        push(pathname, recentGroup, removable)
      } else if (re.test(pathname)) {
        pathMatches.push({ pathname, removable })
      }
    }

    for (const document of this._recentDocuments) addRecentMatch(document.pathname, true)

    for (const tab of _editorState.tabs) {
      if (tab.pathname) addRecentMatch(tab.pathname, this._recentPaths.has(tab.pathname))
    }

    pathMatches.forEach(({ pathname, removable }) => push(pathname, recentGroup, removable))

    if (!isRootDirOpened) {
      return items
    }

    return new Promise<QuickOpenSubcommand[]>((resolve, reject) => {
      let canceled = false
      const promises: Promise<void> & { cancel?: () => void } = this._directorySearcher
        .search(rootPaths, '', {
          didMatch: (result: unknown) => {
            if (canceled || sequence !== this._sequence) return
            push(result as string, fileGroup, false)
          },
          didSearchPaths: (numPathsFound: unknown) => {
            // Cancel when more than 30 files were found. User should specify the search query.
            if (sequence === this._sequence && !canceled && (numPathsFound as number) > 30) {
              canceled = true
              notice.notify({ title: this.description, type: 'info', message: t('search.searchLimited', { count: 30 }) })
              if (promises.cancel) {
                promises.cancel()
              }
            }
          },

          inclusions: this._getInclusions(query)
        })
        .then(() => {
          if (sequence === this._sequence) this._cancelFn = null
          resolve(items)
        })
        .catch((error: unknown) => {
          if (sequence !== this._sequence) { reject(new Error('')); return }
          this._cancelFn = null
          if (items.length) {
            notice.notify({ title: this.description, type: 'warning', message: t('sideBar.search.partialSearch') })
            resolve(items)
          } else reject(error)
        })

      this._cancelFn = () => {
        this._cancelFn = null
        canceled = true
        if (promises.cancel) {
          promises.cancel()
        }
      }
    })
  }

  private _createRegex = (query: string): RegExp =>
    new RegExp(
      query.replace(SPECIAL_CHARS, (p) => {
        if (p === '*') return '.*'
        return p === '\\' ? '\\\\' : `\\${p}`
      }),
      'i'
    )

  _getInclusions = (query: string): string[] => {
    // NOTE: This will fail on `foo.m` because we search for `foo.m.md`.
    if (window.fileUtils.hasMarkdownExtension(query)) {
      return [`*${query}`]
    }

    const inclusions: string[] = []
    for (let i = 0; i < window.fileUtils.MARKDOWN_INCLUSIONS.length; ++i) {
      inclusions[i] = `*${query}` + window.fileUtils.MARKDOWN_INCLUSIONS[i]
    }
    return inclusions
  }

  _getPath = (pathname: string): { title?: string; description: string } => {
    if (this._folderState.FILE_LABEL) return { description: this._folderState.FILE_LABEL(pathname), title: pathname }
    const rootPath = this._folderState.projectTree?.pathname
    if (!rootPath || !window.fileUtils.isChildOfDirectory(rootPath, pathname)) {
      return { title: pathname, description: pathname }
    }

    const p = window.path.relative(rootPath, pathname)
    const item: { title?: string; description: string } = { description: p }
    if (p.length > 50) {
      item.title = p
    }
    return item
  }
}

export default QuickOpenCommand
