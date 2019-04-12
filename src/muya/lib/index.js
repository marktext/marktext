import ContentState from './contentState'
import EventCenter from './eventHandler/event'
import Clipboard from './eventHandler/clipboard'
import Keyboard from './eventHandler/keyboard'
import ClickEvent from './eventHandler/clickEvent'
import { CLASS_OR_ID, MUYA_DEFAULT_OPTION } from './config'
import { wordCount } from './utils'
import ExportMarkdown from './utils/exportMarkdown'
import ExportHtml from './utils/exportHtml'
import ToolTip from './ui/tooltip'
import './assets/styles/index.css'

class Muya {
  static plugins = []
  static use (plugin) {
    this.plugins.push(plugin)
  }
  constructor (container, options) {
    this.options = Object.assign({}, MUYA_DEFAULT_OPTION, options)
    const { focusMode, markdown } = this.options
    this.focusMode = focusMode
    this.markdown = markdown
    this.container = getContainer(container, this.options)
    this.eventCenter = new EventCenter()
    this.tooltip = new ToolTip(this)
    // UI plugins
    if (Muya.plugins.length) {
      for (const Plugin of Muya.plugins) {
        this[Plugin.pluginName] = new Plugin(this)
      }
    }

    this.contentState = new ContentState(this, this.options)
    this.clipboard = new Clipboard(this)
    this.clickEvent = new ClickEvent(this)
    this.keyboard = new Keyboard(this)
    this.init()
  }

  init () {
    const { container, contentState, eventCenter } = this
    contentState.stateRender.setContainer(container.children[0])
    eventCenter.subscribe('stateChange', this.dispatchChange)
    contentState.listenForPathChange()
    const { focusMode, markdown } = this
    this.setMarkdown(markdown)
    this.setFocusMode(focusMode)
  }

  dispatchChange = () => {
    const { eventCenter } = this
    const markdown = this.markdown = this.getMarkdown()
    const wordCount = this.getWordCount(markdown)
    const cursor = this.getCursor()
    const history = this.getHistory()
    const toc = this.getTOC()
    eventCenter.dispatch('change', { markdown, wordCount, cursor, history, toc })
  }

  getMarkdown () {
    const blocks = this.contentState.getBlocks()
    const listIndentation = this.contentState.listIndentation
    return new ExportMarkdown(blocks, listIndentation).generate()
  }

  getHistory () {
    return this.contentState.getHistory()
  }

  getTOC () {
    return this.contentState.getTOC()
  }

  setHistory (history) {
    return this.contentState.setHistory(history)
  }

  clearHistory () {
    return this.contentState.history.clearHistory()
  }

  exportStyledHTML (title = '', printOptimization = false) {
    const { markdown } = this
    return new ExportHtml(markdown, this).generate(title, printOptimization)
  }

  exportHtml () {
    const { markdown } = this
    return new ExportHtml(markdown, this).renderHtml()
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
    setTimeout(() => {
      this.dispatchChange()
    }, 0)
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
    } else if (tabSize > 4) {
      tabSize = 4
    }
    this.contentState.tabSize = tabSize
  }

  setListIndentation (listIndentation) {
    if (typeof listIndentation === 'number') {
      if (listIndentation < 1 || listIndentation > 4) {
        listIndentation = 1
      }
    } else if (listIndentation !== 'dfm') {
      listIndentation = 1
    }
    this.contentState.listIndentation = listIndentation
  }

  updateParagraph (type) {
    this.contentState.updateParagraph(type)
  }

  duplicate () {
    this.contentState.duplicate()
  }

  deleteParagraph () {
    this.contentState.deleteParagraph()
  }

  insertParagraph (location/* before or after */, text = '', outMost = false) {
    this.contentState.insertParagraph(location, text, outMost)
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

  setOptions (options, needRender = false) {
    Object.assign(this.options, options)
    if (needRender) {
      this.contentState.render()
    }
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
function getContainer (originContainer, options) {
  const { hideQuickInsertHint } = options
  const container = document.createElement('div')
  const rootDom = document.createElement('div')
  const attrs = originContainer.attributes
  // copy attrs from origin container to new div element
  Array.from(attrs).forEach(attr => {
    container.setAttribute(attr.name, attr.value)
  })

  if (!hideQuickInsertHint) {
    container.classList.add('ag-show-quick-insert-hint')
  }

  container.setAttribute('contenteditable', true)
  container.setAttribute('autocorrect', false)
  container.setAttribute('autocomplete', 'off')
  container.setAttribute('spellcheck', false)
  container.appendChild(rootDom)
  originContainer.replaceWith(container)
  return container
}

export default Muya
