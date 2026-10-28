import { t } from '@/i18n'
import english from '../../../../static/locales/en.json'
import { isMac } from '@/util'

export interface PreferenceDefinition {
  category: string
  label: string
  notes?: string
  platform?: 'mac' | 'other'
  aliases?: string[]
  fallback?: string
}

// IDs are persisted keys where available; auxiliary controls use stable UI IDs.
export const preferenceDefinitions: Record<string, PreferenceDefinition> = {
  "imageInsertAction": { "category": "images", "label": "preferences.image.defaultBehavior" },
  "defaultOpenMode": {
    "category": "general",
    "label": "readingMode.defaultMode",
    "notes": "readingMode.defaultNote"
  },
  "autoSave": {
    "category": "files",
    "label": "preferences.general.autoSave.description"
  },
  "autoSaveDelay": {
    "category": "files",
    "label": "preferences.general.autoSave.delayDescription"
  },
  "titleBarStyle": {
    "category": "appearance",
    "label": "preferences.general.window.titleBarStyle.title",
    "notes": "preferences.general.window.requiresRestart",
    "platform": "other"
  },
  "hideScrollbar": {
    "category": "appearance",
    "label": "preferences.general.window.hideScrollbars"
  },
  "openFilesInNewWindow": {
    "category": "general",
    "label": "preferences.general.window.openFilesInNewWindow",
    "notes": "preferences.general.window.openFilesInNewWindowNote"
  },
  "openFolderInNewWindow": {
    "category": "general",
    "label": "preferences.general.window.openFoldersInNewWindow",
    "notes": "preferences.general.window.openFoldersInNewWindowNote"
  },
  "zoom": {
    "category": "appearance",
    "label": "preferences.general.window.zoom"
  },
  "tocPosition": {
    "category": "general",
    "label": "preferences.general.sidebar.tocPosition"
  },
  "wordWrapInToc": {
    "category": "general",
    "label": "preferences.general.sidebar.wrapTextInToc"
  },
  "openedFilesInSidebar": {
    "category": "general",
    "label": "preferences.general.sidebar.showOpenedFiles"
  },
  "autoRevealInSidebar": {
    "category": "general",
    "label": "preferences.general.sidebar.autoReveal"
  },
  "openFilesInPreviewMode": {
    "category": "general",
    "label": "preferences.general.sidebar.openFilesInPreviewMode"
  },
  "fileSortBy": {
    "category": "general",
    "label": "preferences.general.sidebar.fileSortBy.title"
  },
  "fileSortOrder": {
    "category": "general",
    "label": "preferences.general.sidebar.fileSortOrder.title"
  },
  "showPandocConvert": {
    "category": "images",
    "label": "preferences.general.pandoc.description"
  },
  "language": {
    "category": "general",
    "label": "preferences.general.language.label"
  },
  "fontSize": {
    "category": "appearance",
    "label": "preferences.editor.textEditor.fontSize"
  },
  "lineHeight": {
    "category": "appearance",
    "label": "preferences.editor.textEditor.lineHeight"
  },
  "editorFontFamily": {
    "category": "appearance",
    "label": "preferences.editor.textEditor.fontFamily"
  },
  "codeFontFamily": {
    "category": "appearance",
    "label": "preferences.editor.textEditor.codeFontFamily",
    "notes": "preferences.editor.textEditor.codeFontFamilyNotes"
  },
  "editorLineWidth": {
    "category": "appearance",
    "label": "preferences.editor.textEditor.maxWidth",
    "notes": "preferences.editor.textEditor.maxWidthNotes"
  },
  "codeFontSize": {
    "category": "appearance",
    "label": "preferences.editor.codeBlock.fontSize"
  },
  "codeBlockLineNumbers": {
    "category": "editor",
    "label": "preferences.editor.codeBlock.showLineNumbers"
  },
  "trimUnnecessaryCodeBlockEmptyLines": {
    "category": "editor",
    "label": "preferences.editor.codeBlock.removeEmptyLines"
  },
  "wrapCodeBlocks": {
    "category": "editor",
    "label": "preferences.editor.misc.wrapCodeBlocks"
  },
  "autoPairBracket": {
    "category": "editor",
    "label": "preferences.editor.writingBehavior.autoCloseBrackets"
  },
  "autoPairMarkdownSyntax": {
    "aliases": ["自动完成 Markdown", "自動完成 Markdown", "Auto complete markdown"],
    "category": "editor",
    "label": "preferences.editor.writingBehavior.autoCompleteMarkdown",
    "notes": "preferences.explanations.markdownPairs"
  },
  "autoPairQuote": {
    "category": "editor",
    "label": "preferences.editor.writingBehavior.autoCloseQuotes"
  },
  "tabSize": {
    "category": "editor",
    "label": "preferences.editor.fileRepresentation.tabWidth",
    "notes": "preferences.editor.fileRepresentation.tabInputNotes"
  },
  "endOfLine": {
    "aliases": ["行分隔符", "行區隔符", "Line separator"],
    "category": "files",
    "label": "preferences.editor.fileRepresentation.lineSeparator",
    "notes": "preferences.explanations.lineEndings"
  },
  "defaultEncoding": {
    "category": "files",
    "label": "preferences.editor.fileRepresentation.defaultEncoding"
  },
  "autoGuessEncoding": {
    "category": "files",
    "label": "preferences.editor.fileRepresentation.autoDetectEncoding"
  },
  "autoNormalizeLineEndings": {
    "category": "files",
    "label": "preferences.editor.misc.autoNormalizeLineEndings"
  },
  "trimTrailingNewline": {
    "category": "files",
    "label": "preferences.editor.fileRepresentation.trailingNewlines.title"
  },
  "textDirection": {
    "category": "editor",
    "label": "preferences.editor.misc.textDirection.title"
  },
  "hideQuickInsertHint": {
    "category": "editor",
    "label": "preferences.editor.misc.hideQuickInsertHint"
  },
  "hideLinkPopup": {
    "category": "editor",
    "label": "preferences.editor.misc.hideLinkPopup"
  },
  "autoCheck": {
    "aliases": ["自动检查", "自動檢查", "Auto check"],
    "category": "editor",
    "label": "preferences.editor.misc.autoCheck",
    "notes": "preferences.explanations.taskCascade"
  },
  "sourceCodeLineNumbers": {
    "category": "editor",
    "label": "preferences.editor.misc.sourceCodeLineNumbers"
  },
  "preferLooseListItem": {
    "category": "markdown",
    "label": "preferences.markdown.lists.preferLooseListItem"
  },
  "bulletListMarker": {
    "category": "markdown",
    "label": "preferences.markdown.lists.bulletListMarker"
  },
  "orderListDelimiter": {
    "category": "markdown",
    "label": "preferences.markdown.lists.orderListDelimiter"
  },
  "listIndentation": {
    "category": "markdown",
    "label": "preferences.markdown.lists.listIndentation.title"
  },
  "frontmatterType": {
    "category": "markdown",
    "label": "preferences.markdown.extensions.frontmatterType.title"
  },
  "superSubScript": {
    "category": "markdown",
    "label": "preferences.markdown.extensions.superSubScript"
  },
  "footnote": {
    "category": "markdown",
    "label": "preferences.markdown.extensions.footnote"
  },
  "texMathDollars": {
    "category": "markdown",
    "label": "preferences.markdown.extensions.texMathDollars"
  },
  "texMathGfm": {
    "category": "markdown",
    "label": "preferences.markdown.extensions.texMathGfm"
  },
  "texMathSingleBackslash": {
    "category": "markdown",
    "label": "preferences.markdown.extensions.texMathSingleBackslash"
  },
  "texMathDoubleBackslash": {
    "category": "markdown",
    "label": "preferences.markdown.extensions.texMathDoubleBackslash"
  },
  "fancyLists": {
    "category": "markdown",
    "label": "preferences.markdown.extensions.fancyLists"
  },
  "highlightSyntax": {
    "category": "markdown",
    "label": "preferences.markdown.extensions.highlightSyntax"
  },
  "inlineDiff": {
    "category": "markdown",
    "label": "preferences.markdown.extensions.inlineDiff"
  },
  "githubAlerts": {
    "category": "markdown",
    "label": "preferences.markdown.extensions.githubAlerts"
  },
  "multilineBlockquote": {
    "category": "markdown",
    "label": "preferences.markdown.extensions.multilineBlockquote"
  },
  "isHtmlEnabled": {
    "category": "markdown",
    "label": "preferences.markdown.compatibility.enableHtml"
  },
  "softNewlineAsSpace": {
    "category": "markdown",
    "label": "preferences.markdown.compatibility.softNewlineAsSpace"
  },
  "mermaidLightTheme": {
    "category": "markdown",
    "label": "preferences.markdown.diagrams.mermaidLightTheme.title"
  },
  "mermaidDarkTheme": {
    "category": "markdown",
    "label": "preferences.markdown.diagrams.mermaidDarkTheme.title"
  },
  "sequenceTheme": {
    "category": "markdown",
    "label": "preferences.markdown.diagrams.sequenceTheme.title"
  },
  "plantumlServer": {
    "category": "markdown",
    "label": "preferences.markdown.diagrams.plantumlServer.title"
  },
  "preferHeadingStyle": {
    "category": "markdown",
    "label": "preferences.markdown.misc.preferHeadingStyle.title"
  },
  "spellcheckerNoUnderline": {
    "category": "editor",
    "label": "preferences.spellchecker.hideMarksForErrors"
  },
  "followSystemTheme": {
    "category": "appearance",
    "label": "preferences.theme.followSystemTheme"
  },
  "lightModeTheme": {
    "category": "appearance",
    "label": "preferences.theme.lightModeTheme",
    "fallback": "followSystemTheme"
  },
  "darkModeTheme": {
    "category": "appearance",
    "label": "preferences.theme.darkModeTheme",
    "fallback": "followSystemTheme"
  },
  "imagePreferRelativeDirectory": {
    "category": "images",
    "label": "preferences.image.folderSetting.preferRelative"
  },
  "imageRelativeDirectoryName": {
    "category": "images",
    "label": "preferences.image.folderSetting.relativeFolderName"
  },
  "treePathExcludePatterns": {
    "category": "general",
    "label": "preferences.general.sidebar.excludePatterns",
    "notes": "preferences.general.sidebar.excludePatternsNotes"
  },
  "startUpAction": {
    "category": "files",
    "label": "preferences.general.startup.action"
  },
  "defaultDirectoryToOpen": {
    "category": "files",
    "label": "preferences.general.startup.selectFolder",
    "fallback": "startUpAction"
  },
  "restoreLayoutState": {
    "category": "files",
    "label": "preferences.general.startup.restoreLayoutState"
  },
  "restoreEditors": {
    "category": "files",
    "label": "preferences.general.startup.restoreEditors"
  },
  "restoreViewState": {
    "category": "files",
    "label": "preferences.general.startup.restoreViewState"
  },
  "spellcheckerEnabled": {
    "category": "editor",
    "label": "preferences.spellchecker.enableSpellChecking"
  },
  "spellcheckerLanguage": {
    "category": "editor",
    "label": "preferences.spellchecker.defaultLanguage",
    "platform": "other"
  },
  "spellcheckerAutoDetectLanguage": {
    "category": "editor",
    "label": "preferences.spellchecker.autoDetectLanguage",
    "platform": "mac"
  },
  "customDictionary": {
    "category": "editor",
    "label": "preferences.spellchecker.customDictionary.title",
    "platform": "other",
    "fallback": "spellcheckerEnabled"
  },
  "theme": {
    "category": "appearance",
    "label": "preferences.theme.title"
  },
  "customCss": {
    "category": "appearance",
    "label": "preferences.theme.customCss"
  },
  "imageUploader": {
    "category": "images",
    "label": "preferences.image.uploader.title"
  },
  "imageFolderPath": {
    "category": "images",
    "label": "preferences.image.folderSetting.globalFolder"
  },
  "cliScript": {
    "category": "images",
    "label": "preferences.image.uploader.scriptLocation",
    "fallback": "imageUploader"
  }
}

export const preferenceLabel = (key: string): string => {
  const definition = preferenceDefinitions[key]
  return definition ? t(definition.label) : key
}
export const preferenceNotes = (key: string): string => {
  const notes = preferenceDefinitions[key]?.notes
  return notes ? t(notes) : ''
}
export const englishText = (path: string): string => {
  let value: unknown = english
  for (const part of path.split('.')) {
    if (!value || typeof value !== 'object') return path
    value = (value as Record<string, unknown>)[part]
  }
  return typeof value === 'string' ? value : path
}
export const isPreferenceAvailable = (definition: PreferenceDefinition): boolean =>
  !definition.platform || (definition.platform === 'mac' ? isMac : !isMac)
