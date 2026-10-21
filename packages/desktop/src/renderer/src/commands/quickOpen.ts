import bus from '../bus'
import { delay } from '@/util'
import FileSearcher from '@/node/fileSearcher'
import type { EditorState } from '@/store/editor'
import getCommandDescriptionById from './descriptions'
import notice from '@/services/notification'
import { t } from '../i18n'

const SPECIAL_CHARS = /[\[\]\\^$.\|\?\*\+\(\)\/]{1}/g // eslint-disable-line no-useless-escape

interface QuickOpenSubcommand {
  id: string
  description?: string
  title?: string
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
  subcommands: QuickOpenSubcommand[]
  subcommandSelectedIndex: number
  private _editorState: EditorState
  private _folderState: FolderState
  private _directorySearcher: FileSearcher
  private _cancelFn: CancelFn
  private _sequence = 0

  constructor(rootState: RootState) {
    this.id = 'file.quick-open'
    this.description = getCommandDescriptionById('file.quick-open')
    this.placeholder = t('commandPalette.placeholders.searchFileToOpen')
    this.shortcut = null

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
    if (!query) return this.subcommands.map(item => ({ id: item.id, ...this._getPath(item.id) }))
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
    if (!this._roots().length && _editorState.tabs.length === 0) {
      throw new Error(null as unknown as string)
    }

    this.subcommands = _editorState.tabs
      .map((tab) => tab.pathname)
      .filter((tabPath: string | null | undefined) => !!tabPath)
      .map((pathname: string) => {
        const item: QuickOpenSubcommand = { id: pathname }
        Object.assign(item, this._getPath(pathname))
        return item
      })
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

  unload = (): void => {
    this._sequence++
    this._cancelFn?.()
    this._cancelFn = null
    this.subcommands = []
  }

  _roots = (): string[] => this._folderState.availableRoots?.map(root => root.pathname)
    ?? (this._folderState.projectTree ? [this._folderState.projectTree.pathname] : [])


  _doSearch = (query: string): QuickOpenSubcommand[] | Promise<QuickOpenSubcommand[]> => {
    this._cancelFn = null
    const { _editorState } = this
    const sequence = this._sequence
    const rootPaths = this._roots()
    const isRootDirOpened = !!rootPaths.length
    const tabsAvailable = _editorState.tabs.length > 0

    if (!isRootDirOpened && !tabsAvailable) {
      return []
    }

    const searchResult: string[] = []

    if (tabsAvailable) {
      const re = new RegExp(
        query.replace(SPECIAL_CHARS, (p) => {
          if (p === '*') return '.*'
          return p === '\\' ? '\\\\' : `\\${p}`
        }),
        'i'
      )

      for (const tab of _editorState.tabs) {
        const { pathname } = tab
        if (
          pathname &&
          re.test(pathname) &&
          !rootPaths.some(rootPath => window.fileUtils.isChildOfDirectory(rootPath, pathname))
        ) {
          searchResult.push(pathname)
        }
      }
    }

    if (!isRootDirOpened) {
      return searchResult.map((pathname) => {
        return {
          id: pathname,
          description: pathname,
          title: pathname
        }
      })
    }

    return new Promise<QuickOpenSubcommand[]>((resolve, reject) => {
      let canceled = false
      const promises: Promise<void> & { cancel?: () => void } = this._directorySearcher
        .search(rootPaths, '', {
          didMatch: (result: unknown) => {
            if (canceled || sequence !== this._sequence) return
            if (!searchResult.includes(result as string)) searchResult.push(result as string)
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
          resolve(
            searchResult.map((pathname) => {
              const item: QuickOpenSubcommand = { id: pathname }
              Object.assign(item, this._getPath(pathname))
              return item
            })
          )
        })
        .catch((error: unknown) => {
          if (sequence !== this._sequence) { reject(new Error('')); return }
          this._cancelFn = null
          if (searchResult.length) {
            notice.notify({ title: this.description, type: 'warning', message: t('sideBar.search.partialSearch') })
            resolve(searchResult.map(pathname => ({ id: pathname, ...this._getPath(pathname) })))
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
