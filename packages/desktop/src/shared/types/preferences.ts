/** Stable preference values shared by startup planning and the settings UI. */
export const StartupAction = {
  RESTORE_ALL: 'restoreAll',
  RESTORE_LAST_WINDOW: 'restoreLastWindow',
  OPEN_LAST_FOLDER: 'openLastFolder',
  FOLDER: 'folder',
  BLANK: 'blank'
} as const

export type StartupAction = (typeof StartupAction)[keyof typeof StartupAction]

/** Startup choice and independently switchable restoration scopes. */
export interface RecoveryPreferences {
  startUpAction: StartupAction
  // Absolute folder path used only by StartupAction.FOLDER.
  defaultDirectoryToOpen: string
  // Native bounds, pane layout and project-tree folding.
  restoreLayoutState: boolean
  // Ordinary saved editors; unsaved recovery contents remain protected independently.
  restoreEditors: boolean
  // Per-document cursor, selection, scroll offsets and outline folding.
  restoreViewState: boolean
}

/** Only keys supplied by the caller are updated; omitted keys retain their current values. */
export type UserPreferencesPatch = Partial<UserPreferences>

/** Validated complete preferences, including defaults for omitted persisted keys. */
export interface UserPreferences extends RecoveryPreferences {
  autoSave: boolean
  autoSaveDelay: number
  titleBarStyle: 'custom' | 'native'
  openFilesInNewWindow: boolean
  openFolderInNewWindow: boolean
  zoom: number
  hideScrollbar: boolean
  wordWrapInToc: boolean
  tocPosition: 'left' | 'right'
  treePathExcludePatterns: string[]
  fileSortBy: 'modified' | 'created' | 'title'
  fileSortOrder: 'asc' | 'desc'
  defaultOpenMode: 'edit' | 'read'
  language: string
  editorFontFamily: string
  fontSize: number
  lineHeight: number
  wrapCodeBlocks: boolean
  editorLineWidth: string
  codeFontSize: number
  codeFontFamily: string
  codeBlockLineNumbers: boolean
  sourceCodeLineNumbers: boolean
  trimUnnecessaryCodeBlockEmptyLines: boolean
  autoPairBracket: boolean
  autoPairMarkdownSyntax: boolean
  autoPairQuote: boolean
  endOfLine: 'default' | 'lf' | 'crlf'
  defaultEncoding:
    | 'ascii'
    | 'utf8'
    | 'utf16be'
    | 'utf16le'
    | 'utf32be'
    | 'utf32le'
    | 'latin3'
    | 'iso885915'
    | 'cp1252'
    | 'arabic'
    | 'cp1256'
    | 'latin4'
    | 'cp1257'
    | 'iso88592'
    | 'windows1250'
    | 'cp866'
    | 'iso88595'
    | 'koi8r'
    | 'koi8u'
    | 'cp1251'
    | 'iso885913'
    | 'greek'
    | 'cp1253'
    | 'hebrew'
    | 'cp1255'
    | 'latin5'
    | 'cp1254'
    | 'gb2312'
    | 'gb18030'
    | 'gbk'
    | 'big5'
    | 'big5hkscs'
    | 'shiftjis'
    | 'eucjp'
    | 'euckr'
    | 'latin6'
  autoGuessEncoding: boolean
  trimTrailingNewline: 0 | 1 | 2 | 3
  textDirection: 'ltr' | 'rtl'
  hideQuickInsertHint: boolean
  hideLinkPopup: boolean
  autoCheck: boolean
  autoNormalizeLineEndings: boolean
  preferLooseListItem: boolean
  bulletListMarker: '-' | '*' | '+'
  orderListDelimiter: '.' | ')'
  preferHeadingStyle: 'atx' | 'setext'
  tabSize: number | 'tab'
  listIndentation: 'dfm' | 'tab' | 1 | 2 | 3 | 4
  frontmatterType: '-' | '+' | ';' | '{'
  superSubScript: boolean
  footnote: boolean
  texMathDollars: boolean
  texMathGfm: boolean
  texMathSingleBackslash: boolean
  texMathDoubleBackslash: boolean
  fancyLists: boolean
  highlightSyntax: boolean
  inlineDiff: boolean
  githubAlerts: boolean
  multilineBlockquote: boolean
  isHtmlEnabled: boolean
  softNewlineAsSpace: boolean
  sequenceTheme: 'hand' | 'simple'
  mermaidLightTheme:
    | 'default'
    | 'forest'
    | 'neutral'
    | 'base'
    | 'dark'
    | 'neo'
    | 'neo-dark'
    | 'redux'
    | 'redux-dark'
    | 'redux-color'
    | 'redux-dark-color'
  mermaidDarkTheme:
    | 'default'
    | 'forest'
    | 'neutral'
    | 'base'
    | 'dark'
    | 'neo'
    | 'neo-dark'
    | 'redux'
    | 'redux-dark'
    | 'redux-color'
    | 'redux-dark-color'
  plantumlServer: string
  theme: string
  followSystemTheme: boolean
  lightModeTheme: string
  darkModeTheme: string
  customCss: string
  spellcheckerEnabled: boolean
  spellcheckerNoUnderline: boolean
  spellcheckerLanguage: string
  imageInsertAction: 'upload' | 'folder' | 'path'
  imagePreferRelativeDirectory: boolean
  imageRelativeDirectoryBase: 'file' | 'folder'
  imageRelativeDirectoryName: string
  sourceCodeModeEnabled: boolean
  openedFilesInSidebar: boolean
  autoRevealInSidebar: boolean
  openFilesInPreviewMode: boolean
  showPandocConvert: boolean
  searchExclusions: string[]
  searchMaxFileSize: string
  searchIncludeHidden: boolean
  searchNoIgnore: boolean
  searchFollowSymlinks: boolean
  watcherUsePolling: boolean
}

export const RECOVERY_DEFAULTS: RecoveryPreferences = {
  startUpAction: 'restoreAll',
  defaultDirectoryToOpen: '',
  restoreLayoutState: true,
  restoreEditors: true,
  restoreViewState: true
}

export type PreferenceUpdateResult =
  | { status: 'persisted'; preferences: UserPreferences }
  | { status: 'failed'; reason: 'invalid-data' | 'storage-unavailable' }

export interface PreferenceSchemaRule {
  type?: string
  enum?: unknown[]
  const?: unknown
  minimum?: number
  maximum?: number
  pattern?: string
  anyOf?: PreferenceSchemaRule[]
  items?: PreferenceSchemaRule
  default?: unknown
}
export interface PreferenceSchemaEntry extends PreferenceSchemaRule {
  description: string
}
