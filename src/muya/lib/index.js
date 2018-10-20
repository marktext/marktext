import ContentState from './contentState'
import EventCenter from './eventHandler/event'
import Clipboard from './eventHandler/clipboard'
import Keyboard from './eventHandler/keyboard'
import ClickEvent from './eventHandler/clickEvent'
import { CLASS_OR_ID } from './config'
import { wordCount } from './utils'
import ExportMarkdown from './utils/exportMarkdown'
import ExportHtml from './utils/exportHtml'
import TablePicker from './ui/tablePicker'
import ToolTip from './ui/tooltip'
import QuickInsert from './ui/quickInsert'
import CodePicker from './ui/codePicker'
import EmojiPicker from './ui/emojiPicker'
import ImagePathPicker from './ui/imagePicker'
import FormatPicker from './ui/formatPicker'
import './assets/symbolIcon' // import symbol icons
import './assets/symbolIcon/index.css'
import './assets/styles/index.css'

class Muya {
  constructor (container, options) {
    const {
      focusMode = false, theme = 'light', markdown = '', preferLooseListItem = true,
      autoPairBracket = true, autoPairMarkdownSyntax = true, autoPairQuote = true,
      bulletListMarker = '-', tabSize = 4
    } = options
    this.focusMode = focusMode
    this.theme = theme
    this.markdown = markdown
    this.container = getContainer(container)
    this.eventCenter = new EventCenter()
    this.tooltip = new ToolTip(this)
    this.quickInsert = new QuickInsert(this)
    this.codePicker = new CodePicker(this)
    this.tablePicker = new TablePicker(this)
    this.emojiPicker = new EmojiPicker(this)
    this.imagePathPicker = new ImagePathPicker(this)
    this.formatPicker = new FormatPicker(this)
    this.contentState = new ContentState(this, { preferLooseListItem, autoPairBracket, autoPairMarkdownSyntax, autoPairQuote, bulletListMarker, tabSize })
    this.clipboard = new Clipboard(this)
    this.clickEvent = new ClickEvent(this)
    this.keyboard = new Keyboard(this)
    this.init()
  }

  init () {
    const { container, contentState, eventCenter } = this
    contentState.stateRender.setContainer(container.children[0])
    eventCenter.subscribe('stateChange', this.dispatchChange.bind(this))
    eventCenter.attachDOMEvent(container, 'contextmenu', event => {
      event.preventDefault()
      event.stopPropagation()
      const sectionChanges = this.contentState.selectionChange(this.contentState.cursor)
      eventCenter.dispatch('contextmenu', event, sectionChanges)
    })
    contentState.listenForPathChange()
    const { theme, focusMode, markdown } = this
    this.setTheme(theme)
    this.setMarkdown(markdown)
    this.setFocusMode(focusMode)
  }

  dispatchChange () {
    const { eventCenter } = this
    const markdown = this.markdown = this.getMarkdown()
    const wordCount = this.getWordCount(markdown)
    const cursor = this.getCursor()
    const history = this.getHistory()
    eventCenter.dispatch('change', { markdown, wordCount, cursor, history })
  }

  getMarkdown () {
    const blocks = this.contentState.getBlocks()
    return new ExportMarkdown(blocks).generate()
  }

  getHistory () {
    return this.contentState.getHistory()
  }

  setHistory (history) {
    return this.contentState.setHistory(history)
  }

  clearHistory () {
    return this.contentState.history.clearHistory()
  }

  exportStyledHTML (filename) {
    const { markdown } = this
    return new ExportHtml(markdown).generate(filename)
  }

  exportHtml () {
    const { markdown } = this
    return new ExportHtml(markdown).renderHtml()
  }

  getWordCount (markdown) {
    return wordCount(markdown)
  }

  getCursor () {
    return this.contentState.getCodeMirrorCursor()
  }

  setMarkdown (markdown, cursor, isRenderCursor = true) {
    let newMarkdown = markdown
    if (cursor) {
      newMarkdown = this.contentState.addCursorToMarkdown(markdown, cursor)
    }
    this.contentState.importMarkdown(newMarkdown)
    this.contentState.importCursor(cursor)
    this.contentState.render(isRenderCursor)
    this.dispatchChange()
  }

  createTable (tableChecker) {
    return this.contentState.createTable(tableChecker)
  }

  getSelection () {
    return this.contentState.selectionChange()
  }

  setFocusMode (bool) {
    const { container, focusMode } = this
    if (bool && !focusMode) {
      container.classList.add(CLASS_OR_ID['AG_FOCUS_MODE'])
    } else {
      container.classList.remove(CLASS_OR_ID['AG_FOCUS_MODE'])
    }
    this.focusMode = bool
  }

  setTheme (name) {
    if (!name) return
    const { eventCenter } = this
    this.theme = name
    // Render cursor and refresh code block
    this.contentState.render(true)
    // notice the ui components to change theme
    eventCenter.dispatch('theme-change', name)
  }

  setFont ({ fontSize, lineHeight }) {
    if (fontSize) this.contentState.fontSize = parseInt(fontSize, 10)
    if (lineHeight) this.contentState.lineHeight = lineHeight
  }

  setListItemPreference (preferLooseListItem) {
    this.contentState.preferLooseListItem = preferLooseListItem
  }

  setTabSize (tabSize) {
    if (!tabSize || typeof tabSize !== 'number') {
      tabSize = 4
    } else if (tabSize < 1) {
      tabSize = 1
    }

    this.contentState.tabSize = tabSize
  }

  updateParagraph (type) {
    this.contentState.updateParagraph(type)
  }

  insertParagraph (location/* before or after */) {
    this.contentState.insertParagraph(location)
  }

  editTable (data) {
    this.contentState.editTable(data)
  }

  hasFocus () {
    return document.activeElement === this.container
  }

  focus () {
    this.contentState.setCursor()
    this.container.focus()
  }

  blur () {
    this.container.blur()
  }

  showAutoImagePath (files) {
    const list = files.map(f => {
      const iconClass = f.type === 'directory' ? 'icon-folder' : 'icon-image'
      return Object.assign(f, { iconClass, text: f.file + (f.type === 'directory' ? '/' : '') })
    })
    this.contentState.showAutoImagePath(list)
  }

  format (type) {
    this.contentState.format(type)
  }

  insertImage (url) {
    this.contentState.insertImage(url)
  }

  search (value, opt) {
    const { selectHighlight } = opt
    this.contentState.search(value, opt)
    this.contentState.render(!!selectHighlight)
    return this.contentState.searchMatches
  }

  replace (value, opt) {
    this.contentState.replace(value, opt)
    this.contentState.render(false)
    return this.contentState.searchMatches
  }

  find (action/* pre or next */) {
    this.contentState.find(action)
    this.contentState.render(false)
    return this.contentState.searchMatches
  }

  on (event, listener) {
    this.eventCenter.subscribe(event, listener)
  }

  off (event, listener) {
    this.eventCenter.unsubscribe(event, listener)
  }

  once (event, listener) {
    this.eventCenter.subscribeOnce(event, listener)
  }

  undo () {
    this.contentState.history.undo()
  }

  redo () {
    this.contentState.history.redo()
  }

  copyAsMarkdown () {
    this.clipboard.copyAsMarkdown()
  }

  copyAsHtml () {
    this.clipboard.copyAsHtml()
  }

  pasteAsPlainText () {
    this.clipboard.pasteAsPlainText()
  }

  copy (name) {
    this.clipboard.copy(name)
  }

  destroy () {
    this.contentState.clear()
    this.quickInsert.destroy()
    this.codePicker.destroy()
    this.tablePicker.destroy()
    this.emojiPicker.destroy()
    this.imagePathPicker.destroy()
    this.eventCenter.detachAllDomEvents()
  }
}

/**
  * [ensureContainerDiv ensure container element is div]
  */
function getContainer (originContainer) {
  const container = document.createElement('div')
  const rootDom = document.createElement('div')
  const attrs = originContainer.attributes
  // copy attrs from origin container to new div element
  Array.from(attrs).forEach(attr => {
    container.setAttribute(attr.name, attr.value)
  })
  container.setAttribute('contenteditable', true)
  container.appendChild(rootDom)
  originContainer.replaceWith(container)
  return container
}

export default Muya
