import { defineStore } from 'pinia'
import bus from '../bus'
import { setLanguage } from '../i18n'

// Finite-value unions where the runtime currently constrains the field.
// We keep these as plain strings everywhere else to avoid forcing prematurely
// narrow casts on consumers that read raw values from disk.
export type EndOfLine = 'default' | 'lf' | 'crlf'
export type TitleBarStyle = 'custom' | 'native'
export type StartUpAction = 'restoreAll' | 'lastSession' | 'blank'
export type TextDirection = 'ltr' | 'rtl'
export type BulletListMarker = '*' | '+' | '-'
export type OrderListDelimiter = '.' | ')'
export type PreferHeadingStyle = 'atx' | 'setext'
export type FrontmatterType = '-' | ';' | '{' | '+'
export type SequenceTheme = 'hand' | 'simple'
export type ImageInsertAction = 'folder' | 'path' | 'upload'
export type ImageRelativeDirectoryBase = 'file' | 'root'
export type FileSortBy = 'created' | 'modified' | 'title'

export interface GithubImageBedConfig {
  owner: string
  repo: string
  branch: string
}

export interface ImageBedConfig {
  github: GithubImageBedConfig
}

export interface PreferencesState {
  // ----- General -----
  autoSave: boolean
  autoSaveDelay: number
  titleBarStyle: TitleBarStyle | string
  openFilesInNewWindow: boolean
  openFolderInNewWindow: boolean
  zoom: number
  hideScrollbar: boolean
  wordWrapInToc: boolean
  fileSortBy: FileSortBy | string
  startUpAction: StartUpAction | string
  restoreLayoutState: boolean
  defaultDirectoryToOpen: string
  lastOpenedFolder: string
  treePathExcludePatterns: string[]
  language: string

  // ----- Editor / typography -----
  editorFontFamily: string
  fontSize: number
  lineHeight: number
  codeFontSize: number
  codeFontFamily: string
  codeBlockLineNumbers: boolean
  trimUnnecessaryCodeBlockEmptyLines: boolean
  wrapCodeBlocks: boolean
  editorLineWidth: string

  // ----- Markdown editing -----
  autoPairBracket: boolean
  autoPairMarkdownSyntax: boolean
  autoPairQuote: boolean
  endOfLine: EndOfLine | string
  defaultEncoding: string
  autoGuessEncoding: boolean
  autoNormalizeLineEndings: boolean

  trimTrailingNewline: number
  textDirection: TextDirection | string
  hideQuickInsertHint: boolean
  imageInsertAction: ImageInsertAction | string
  imagePreferRelativeDirectory: boolean
  imageRelativeDirectoryBase: ImageRelativeDirectoryBase | string
  imageRelativeDirectoryName: string
  hideLinkPopup: boolean
  autoCheck: boolean

  preferLooseListItem: boolean
  bulletListMarker: BulletListMarker | string
  orderListDelimiter: OrderListDelimiter | string
  preferHeadingStyle: PreferHeadingStyle | string
  tabSize: number
  listIndentation: number
  frontmatterType: FrontmatterType | string
  superSubScript: boolean
  footnote: boolean
  isHtmlEnabled: boolean
  isGitlabCompatibilityEnabled: boolean
  sequenceTheme: SequenceTheme | string

  // ----- Theme -----
  theme: string
  followSystemTheme: boolean
  lightModeTheme: string
  darkModeTheme: string
  customCss: string

  // ----- Spellchecker -----
  spellcheckerEnabled: boolean
  spellcheckerNoUnderline: boolean
  spellcheckerLanguage: string

  // ----- Side bar / tab bar visibility (persisted) -----
  sideBarVisibility: boolean
  tabBarVisibility: boolean
  sourceCodeModeEnabled: boolean

  // ----- Search -----
  searchExclusions: string[]
  searchMaxFileSize: string
  searchIncludeHidden: boolean
  searchNoIgnore: boolean
  searchFollowSymlinks: boolean

  watcherUsePolling: boolean

  // ----- Edit modes (per-window, not persisted) -----
  typewriter: boolean
  focus: boolean
  sourceCode: boolean

  // ----- User config -----
  imageFolderPath: string
  webImages: unknown[]
  cloudImages: unknown[]
  currentUploader: string
  githubToken: string
  imageBed: ImageBedConfig
  cliScript: string
}

interface SingleSetPreferencePayload {
  type: keyof PreferencesState | string
  value: unknown
}

interface SetUserDataPayload {
  type: string
  value: unknown
}

interface ModeTogglePayload {
  type: keyof PreferencesState | 'typewriter' | 'focus' | 'sourceCode'
  checked: boolean
}

export const usePreferencesStore = defineStore('preferences', {
  state: (): PreferencesState => ({
    autoSave: false,
    autoSaveDelay: 5000,
    titleBarStyle: 'custom',
    openFilesInNewWindow: false,
    openFolderInNewWindow: false,
    zoom: 1.0,
    hideScrollbar: false,
    wordWrapInToc: false,
    fileSortBy: 'created',
    startUpAction: 'restoreAll',
    restoreLayoutState: true,
    defaultDirectoryToOpen: '',
    lastOpenedFolder: '',
    treePathExcludePatterns: [],
    language: 'en',

    editorFontFamily: 'Open Sans',
    fontSize: 16,
    lineHeight: 1.6,
    codeFontSize: 14,
    codeFontFamily: 'DejaVu Sans Mono',
    codeBlockLineNumbers: true,
    trimUnnecessaryCodeBlockEmptyLines: true,
    wrapCodeBlocks: true,
    editorLineWidth: '',

    autoPairBracket: true,
    autoPairMarkdownSyntax: true,
    autoPairQuote: true,
    endOfLine: 'default',
    defaultEncoding: 'utf8',
    autoGuessEncoding: true,
    autoNormalizeLineEndings: false,

    trimTrailingNewline: 2,
    textDirection: 'ltr',
    hideQuickInsertHint: false,
    imageInsertAction: 'folder',
    imagePreferRelativeDirectory: false,
    imageRelativeDirectoryBase: 'file',
    imageRelativeDirectoryName: 'assets',
    hideLinkPopup: false,
    autoCheck: false,

    preferLooseListItem: true,
    bulletListMarker: '-',
    orderListDelimiter: '.',
    preferHeadingStyle: 'atx',
    tabSize: 4,
    listIndentation: 1,
    frontmatterType: '-',
    superSubScript: false,
    footnote: false,
    isHtmlEnabled: true,
    isGitlabCompatibilityEnabled: false,
    sequenceTheme: 'hand',

    theme: 'light',
    followSystemTheme: true,
    lightModeTheme: 'light',
    darkModeTheme: 'dark',
    customCss: '',

    spellcheckerEnabled: false,
    spellcheckerNoUnderline: false,
    spellcheckerLanguage: 'en-US',

    // Default values that are overwritten with the entries below.
    sideBarVisibility: false,
    tabBarVisibility: false,
    sourceCodeModeEnabled: false,

    searchExclusions: [],
    searchMaxFileSize: '',
    searchIncludeHidden: false,
    searchNoIgnore: false,
    searchFollowSymlinks: true,

    watcherUsePolling: false,

    // --------------------------------------------------------------------------

    // Edit modes of the current window (not part of persistent settings)
    typewriter: false, // typewriter mode
    focus: false, // focus mode
    sourceCode: false, // source code mode

    // user configration
    imageFolderPath: '',
    webImages: [],
    cloudImages: [],
    currentUploader: 'none',
    githubToken: '',
    imageBed: {
      github: {
        owner: '',
        repo: '',
        branch: ''
      }
    },
    cliScript: ''
  }),

  getters: {
    getAll: (state): PreferencesState => state
  },

  actions: {
    SET_USER_PREFERENCE(preference: Partial<PreferencesState> | Record<string, unknown>): void {
      const oldLanguage = this.language

      Object.keys(preference).forEach((key) => {
        const incoming = (preference as Record<string, unknown>)[key]
        if (
          typeof incoming !== 'undefined' &&
          typeof (this as unknown as Record<string, unknown>)[key] !== 'undefined'
        ) {
          ;(this as unknown as Record<string, unknown>)[key] = incoming
        }
      })

      // Update i18n language if language preference changed
      const lang = (preference as { language?: string }).language
      if (lang && lang !== oldLanguage) {
        setLanguage(lang)
      }
    },

    SET_MODE({ type, checked }: ModeTogglePayload): void {
      ;(this as unknown as Record<string, unknown>)[type as string] = checked
    },

    TOGGLE_VIEW_MODE(entryName: keyof PreferencesState | string): void {
      const target = this as unknown as Record<string, unknown>
      target[entryName as string] = !target[entryName as string]
    },

    ASK_FOR_USER_PREFERENCE(): void {
      window.electron.ipcRenderer.send('mt::ask-for-user-preference')
      window.electron.ipcRenderer.send('mt::ask-for-user-data')

      window.electron.ipcRenderer.on('mt::user-preference', (_e, preferences) => {
        this.SET_USER_PREFERENCE(preferences as Partial<PreferencesState>)
      })
    },

    SET_SINGLE_PREFERENCE({ type, value }: SingleSetPreferencePayload): void {
      // Update local state
      ;(this as unknown as Record<string, unknown>)[type as string] = value

      // Update i18n language if language preference changed
      if (type === 'language' && typeof value === 'string') {
        setLanguage(value)
      }

      // save to electron-store
      window.electron.ipcRenderer.send('mt::set-user-preference', { [type as string]: value })
    },

    SET_USER_DATA({ type, value }: SetUserDataPayload): void {
      window.electron.ipcRenderer.send('mt::set-user-data', { [type]: value })
    },

    SET_IMAGE_FOLDER_PATH(value: string): void {
      window.electron.ipcRenderer.send('mt::ask-for-modify-image-folder-path', value)
    },

    SELECT_DEFAULT_DIRECTORY_TO_OPEN(): void {
      window.electron.ipcRenderer.send('mt::select-default-directory-to-open')
    },

    LISTEN_FOR_VIEW(): void {
      window.electron.ipcRenderer.on('mt::show-command-palette', () => {
        bus.emit('show-command-palette')
      })
      window.electron.ipcRenderer.on('mt::toggle-view-mode-entry', (_event, entryName) => {
        this.TOGGLE_VIEW_MODE(entryName)
        const target = this as unknown as Record<string, unknown>
        this.DISPATCH_EDITOR_VIEW_STATE({ [entryName]: target[entryName] })
      })
    },

    // Toggle a view option and notify main process to toggle menu item.
    LISTEN_TOGGLE_VIEW(): void {
      bus.on('view:toggle-view-entry', (entryName) => {
        const name = entryName as string
        this.TOGGLE_VIEW_MODE(name)
        const target = this as unknown as Record<string, unknown>
        this.DISPATCH_EDITOR_VIEW_STATE({ [name]: target[name] })
      })
    },

    DISPATCH_EDITOR_VIEW_STATE(viewState: Record<string, unknown>): void {
      const { windowId } = window.marktext?.env ?? { windowId: -1 }
      window.electron.ipcRenderer.send('mt::view-layout-changed', windowId, viewState)
    }
  }
})
