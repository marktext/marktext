// Renderer-facing preference shape; the canonical schema lives in main/preferences/schema.json.

export interface IUserPreferences {
  defaultOpenMode?: 'edit' | 'read'
  autoSave?: boolean
  autoSaveDelay?: number
  titleBarStyle?: 'custom' | 'native'
  openFilesInNewWindow?: boolean
  openFolderInNewWindow?: boolean
  hideScrollbar?: boolean
  tocVisibility?: boolean
  sidebarColumn?: number
  fileSortBy?: string
  fileSortOrder?: string
  startUpAction?: string
  defaultDirectoryToOpen?: string
  language?: string
  editorFontFamily?: string
  fontSize?: number
  lineHeight?: number
  codeFontSize?: number
  codeFontFamily?: string
  hideQuickInsertHint?: boolean
  hideLinkPopup?: boolean
  openedFilesInSidebar?: boolean
  autoRevealInSidebar?: boolean
  openFilesInPreviewMode?: boolean
  autoPairBracket?: boolean
  autoPairMarkdownSyntax?: boolean
  autoPairQuote?: boolean
  endOfLine?: 'default' | 'lf' | 'crlf'
  defaultEncoding?: string
  autoGuessEncoding?: boolean
  trimTrailingNewline?: number
  textDirection?: 'ltr' | 'rtl' | 'auto'
  preferLooseListItem?: boolean
  bulletListMarker?: '-' | '*' | '+'
  orderListDelimiter?: '.' | ')'
  preferHeadingStyle?: 'atx' | 'setext'
  tabSize?: number
  listIndentation?: number | string
  frontmatterType?: '-' | ';' | '+' | '{'
  superSubScript?: boolean
  footnote?: boolean
  texMathDollars?: boolean
  texMathGfm?: boolean
  texMathSingleBackslash?: boolean
  texMathDoubleBackslash?: boolean
  highlightSyntax?: boolean
  inlineDiff?: boolean
  multilineBlockquote?: boolean
  githubAlerts?: boolean
  isHtmlEnabled?: boolean
  softNewlineAsSpace?: boolean
  theme?: string
  spellcheckerEnabled?: boolean
  spellcheckerNoUnderline?: boolean
  spellcheckerLanguage?: string
  imageInsertAction?: 'upload' | 'folder' | 'path'
  imagePreferRelativePath?: boolean
  imageFolderPath?: string
  screenshotFolderPath?: string
  imageBed?: { selected?: string; [key: string]: unknown }
  imageBedAlias?: { [key: string]: unknown }
  watcher?: { usePolling?: boolean; [key: string]: unknown }
  searchExclusions?: string[]
  searchMaxFileSize?: string
  searchIncludeHidden?: boolean
  searchNoIgnore?: boolean
  searchFollowSymlinks?: boolean
  followSystemTheme?: boolean
  lightModeTheme?: string
  darkModeTheme?: string
  lastOpenedFolder?: string
  autoNormalizeLineEndings?: boolean
  watcherUsePolling?: boolean
  treePathExcludePatterns?: string[]
  showPandocConvert?: boolean
  [key: string]: unknown
}

export interface LayoutState {
  rightColumn: 'files' | 'search'
  showSideBar: boolean
  showTabBar: boolean
  [key: string]: unknown
}
