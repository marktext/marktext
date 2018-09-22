import ContentState from './contentState'
import selection from './selection'
import EventCenter from './event'
import { LOWERCASE_TAGS, EVENT_KEYS, CLASS_OR_ID, codeMirrorConfig } from './config'
import { throttle, wordCount } from './utils'
import { search } from './codeMirror'
import { checkEditLanguage } from './codeMirror/language'
import Emoji, { checkEditEmoji, setInlineEmoji } from './emojis'
import FloatBox from './floatBox'
import { findNearestParagraph, operateClassName, isInElement } from './utils/domManipulate'
import ExportMarkdown from './utils/exportMarkdown'
import ExportHtml from './utils/exportHtml'
import { checkEditImage } from './utils/checkEditImage'
import exportHtml from './utils/exportUnstylishHtml'
import TablePicker from './tablePicker'

import './assets/symbolIcon' // import symbol icons
import './assets/symbolIcon/index.css'
import './index.css'

class Muya {
  constructor (container, options) {
    const {
      focusMode = false, theme = 'light', markdown = '', preferLooseListItem = true,
      autoPairBracket = true, autoPairMarkdownSyntax = true, autoPairQuote = true,
      bulletListMarker = '-', tabSize = 4
    } = options
    this.container = container
    const eventCenter = this.eventCenter = new EventCenter()
    const floatBox = this.floatBox = new FloatBox(eventCenter)
    const tablePicker = this.tablePicker = new TablePicker(eventCenter)
    this.contentState = new ContentState({
      eventCenter,
      floatBox,
      tablePicker,
      preferLooseListItem,
      autoPairBracket,
      autoPairMarkdownSyntax,
      autoPairQuote,
      bulletListMarker,
      tabSize
    })
    this.emoji = new Emoji() // emoji instance: has search(text) clear() methods.
    this.focusMode = focusMode
    this.theme = theme
    this.markdown = markdown
    this.fontSize = 16
    this.lineHeight = 1.6
    this.preferLooseListItem = preferLooseListItem
    // private property
    this._isEditChinese = false // true or false
    this._copyType = 'normal' // `normal` or `copyAsMarkdown` or `copyAsHtml`
    this._pasteType = 'normal' // `normal` or `pasteAsPlainText`
    this.init()
  }

  init () {
    this.ensureContainerDiv()
    const { container, contentState, eventCenter } = this
    contentState.stateRender.setContainer(container.children[0])

    eventCenter.subscribe('editEmoji', throttle(this.subscribeEditEmoji.bind(this), 200))
    this.dispatchEditEmoji()
    eventCenter.subscribe('editLanguage', throttle(this.subscribeEditLanguage.bind(this)))
    this.dispatchEditLanguage()

    eventCenter.subscribe('hideFloatBox', this.subscribeHideFloatBox.bind(this))
    this.dispatchHideFloatBox()

    eventCenter.subscribe('stateChange', this.dispatchChange.bind(this))

    eventCenter.attachDOMEvent(container, 'paste', event => {
      contentState.pasteHandler(event, this._pasteType)
      this._pasteType = 'normal'
    })

    eventCenter.attachDOMEvent(container, 'contextmenu', event => {
      event.preventDefault()
      event.stopPropagation()
      const sectionChanges = this.contentState.selectionChange(undefined, undefined, this.contentState.cursor)
      eventCenter.dispatch('contextmenu', event, sectionChanges)
    })

    this.recordEditChinese()
    this.imageClick()
    this.listItemCheckBoxClick()
    this.dispatchArrow()
    this.dispatchBackspace()
    this.dispatchEnter()
    this.dispatchSelection()
    this.dispatchUpdateState()
    this.dispatchCopyCut()
    this.dispatchTableToolBar()
    this.dispatchCodeBlockClick()
    this.htmlPreviewClick()
    this.mathPreviewClick()

    contentState.listenForPathChange()

    const { theme, focusMode, markdown } = this
    this.setTheme(theme)
    this.setMarkdown(markdown)
    this.setFocusMode(focusMode)
  }

  /**
   * [ensureContainerDiv ensure container element is div]
   */
  ensureContainerDiv () {
    const { container } = this
    const div = document.createElement(LOWERCASE_TAGS.div)
    const rootDom = document.createElement(LOWERCASE_TAGS.div)
    const attrs = container.attributes
    const parentNode = container.parentNode
    // copy attrs from origin container to new div element
    Array.from(attrs).forEach(attr => {
      div.setAttribute(attr.name, attr.value)
    })
    div.setAttribute('contenteditable', true)
    div.classList.add('mousetrap')
    div.appendChild(rootDom)
    parentNode.insertBefore(div, container)
    parentNode.removeChild(container)
    this.container = div
  }

  dispatchChange () {
    const { eventCenter } = this
    const markdown = this.markdown = this.getMarkdown()
    const wordCount = this.getWordCount(markdown)
    const cursor = this.getCursor()
    const history = this.getHistory()
    eventCenter.dispatch('change', { markdown, wordCount, cursor, history })
  }

  dispatchCopyCut () {
    const { container, eventCenter, contentState } = this
    const handler = event => {
      contentState.copyHandler(event, this._copyType)
      if (event.type === 'cut') {
        // when user use `cut` function, the dom has been deleted by default.
        // But should update content state manually.
        contentState.cutHandler()
      }
      this._copyType = 'normal'
    }
    eventCenter.attachDOMEvent(container, 'cut', handler)
    eventCenter.attachDOMEvent(container, 'copy', handler)
  }

  /**
   * dispatchEditEmoji
  */
  dispatchEditEmoji () {
    const { container, eventCenter } = this
    const changeHandler = event => {
      const node = selection.getSelectionStart()
      const emojiNode = checkEditEmoji(node)
      if (emojiNode && event.key !== EVENT_KEYS.Enter) {
        eventCenter.dispatch('editEmoji', emojiNode)
      }
    }
    eventCenter.attachDOMEvent(container, 'keyup', changeHandler) // don't listen `input` event
  }

  subscribeEditEmoji (emojiNode) {
    const text = emojiNode.textContent.trim()
    if (text) {
      const list = this.emoji.search(text).map(l => {
        return Object.assign(l, { text: l.aliases[0] })
      })
      const cb = item => {
        setInlineEmoji(emojiNode, item, selection)
        this.floatBox.hideIfNeeded()
      }
      if (list.length) {
        this.floatBox.showIfNeeded(emojiNode, cb)
        this.floatBox.setOptions(list)
      } else {
        this.floatBox.hideIfNeeded()
      }
    }
  }

  dispatchHideFloatBox () {
    const { container, eventCenter } = this
    let cacheTop = null
    const handler = event => {
      if (event.type === 'scroll') {
        const scrollTop = container.scrollTop
        if (cacheTop && Math.abs(scrollTop - cacheTop) > 10) {
          cacheTop = null
          return eventCenter.dispatch('hideFloatBox')
        } else {
          cacheTop = scrollTop
          return
        }
      }
      if (event.target && event.target.classList.contains(CLASS_OR_ID['AG_LANGUAGE_INPUT'])) {
        return
      }
      if (event.type === 'click') return eventCenter.dispatch('hideFloatBox')
      const node = selection.getSelectionStart()
      const paragraph = findNearestParagraph(node)
      const selectionState = selection.exportSelection(paragraph)
      const lang = checkEditLanguage(paragraph, selectionState)
      const emojiNode = node && checkEditEmoji(node)
      const editImage = checkEditImage()

      if (!emojiNode && !lang && !editImage) {
        eventCenter.dispatch('hideFloatBox')
      }
    }

    eventCenter.attachDOMEvent(container, 'click', handler)
    eventCenter.attachDOMEvent(container, 'keyup', handler)
    eventCenter.attachDOMEvent(container, 'scroll', throttle(handler, 200))
  }

  subscribeHideFloatBox () {
    this.floatBox.hideIfNeeded()
  }

  /**
   * dispatchIsEditLanguage
   */
  dispatchEditLanguage () {
    const { container, eventCenter } = this
    const inputHandler = event => {
      const node = selection.getSelectionStart()
      const paragraph = findNearestParagraph(node)
      const selectionState = selection.exportSelection(paragraph)
      const lang = checkEditLanguage(paragraph, selectionState)
      if (lang) {
        eventCenter.dispatch('editLanguage', paragraph, lang)
      }
    }

    eventCenter.attachDOMEvent(container, 'input', inputHandler)
  }

  subscribeEditLanguage (paragraph, lang, cb) {
    const modes = search(lang).map(mode => {
      return Object.assign(mode, { text: mode.name })
    })

    const callback = item => {
      this.contentState.selectLanguage(paragraph, item.name)
    }
    if (modes.length) {
      this.floatBox.showIfNeeded(paragraph, cb || callback)
      this.floatBox.setOptions(modes)
    } else {
      this.floatBox.hideIfNeeded()
    }
  }

  dispatchBackspace () {
    const { container, eventCenter } = this

    const handler = event => {
      if (event.key === EVENT_KEYS.Backspace) {
        this.contentState.backspaceHandler(event)
      } else if (event.key === EVENT_KEYS.Delete) {
        this.contentState.deleteHandler(event)
      }
    }

    eventCenter.attachDOMEvent(container, 'keydown', handler)
  }

  recordEditChinese () {
    const { container, eventCenter } = this
    const handler = event => {
      if (event.type === 'compositionstart') {
        this._isEditChinese = true
      } else if (event.type === 'compositionend') {
        this._isEditChinese = false
      }
    }

    eventCenter.attachDOMEvent(container, 'compositionend', handler)
    eventCenter.attachDOMEvent(container, 'compositionstart', handler)
  }

  dispatchEnter (event) {
    const { container, eventCenter } = this

    const handler = event => {
      if (event.key === EVENT_KEYS.Enter && !this._isEditChinese) {
        this.contentState.enterHandler(event)
      }
    }

    eventCenter.attachDOMEvent(container, 'keydown', handler)
  }

  dispatchSelection (event) {
    const { container, eventCenter } = this
    const handler = event => {
      if (event.ctrlKey && event.key === 'a') {
        this.contentState.tableCellHandler(event)
      }
    }

    eventCenter.attachDOMEvent(container, 'keydown', handler)
  }

  // dispatch arrow event
  dispatchArrow () {
    const { container, eventCenter } = this
    const handler = event => {
      if (this._isEditChinese) return
      switch (event.key) {
        case EVENT_KEYS.ArrowUp: // fallthrough
        case EVENT_KEYS.ArrowDown: // fallthrough
        case EVENT_KEYS.ArrowLeft: // fallthrough
        case EVENT_KEYS.ArrowRight: // fallthrough
          this.contentState.arrowHandler(event)
          break
        case EVENT_KEYS.Tab:
          this.contentState.tabHandler(event)
          break
      }
    }
    eventCenter.attachDOMEvent(container, 'keydown', handler)
  }

  dispatchCodeBlockClick () {
    const { container, eventCenter } = this
    const handler = event => {
      const target = event.target
      if (target.tagName === 'PRE' && target.classList.contains(CLASS_OR_ID['AG_CODE_BLOCK'])) {
        this.contentState.focusCodeBlock(event)
      }
    }

    eventCenter.attachDOMEvent(container, 'click', handler)
  }

  dispatchTableToolBar () {
    const { container, eventCenter } = this
    const getToolItem = target => {
      // poor implement， fix me @jocs
      const parent = target.parentNode
      const grandPa = parent && parent.parentNode
      if (target.hasAttribute('data-label')) return target
      if (parent && parent.hasAttribute('data-label')) return parent
      if (grandPa && grandPa.hasAttribute('data-label')) return grandPa
      return null
    }
    const handler = event => {
      const target = event.target
      const toolItem = getToolItem(target)
      if (toolItem) {
        event.preventDefault()
        event.stopPropagation()
        const type = toolItem.getAttribute('data-label')
        const grandPa = toolItem.parentNode.parentNode
        if (grandPa.classList.contains('ag-tool-table')) {
          this.contentState.tableToolBarClick(type)
        } else if (grandPa.classList.contains('ag-tool-html')) {
          this.contentState.htmlToolBarClick(type)
        }
      }
    }

    eventCenter.attachDOMEvent(container, 'click', handler)
  }

  dispatchUpdateState () {
    const { container, eventCenter } = this
    let timer = null
    const changeHandler = event => {
      const target = event.target
      if (event.type === 'click' && target.classList.contains(CLASS_OR_ID['AG_FUNCTION_HTML'])) return
      if (!this._isEditChinese) {
        this.contentState.updateState(event)
      }
      if (event.type === 'click' || event.type === 'keyup') {
        if (timer) clearTimeout(timer)
        timer = setTimeout(() => {
          const selectionChanges = this.getSelection()
          const { formats } = this.contentState.selectionFormats()
          eventCenter.dispatch('selectionChange', selectionChanges)
          eventCenter.dispatch('selectionFormats', formats)
          this.dispatchChange()
        })
      }
    }

    eventCenter.attachDOMEvent(container, 'click', changeHandler)
    eventCenter.attachDOMEvent(container, 'keyup', changeHandler)
    eventCenter.attachDOMEvent(container, 'input', changeHandler)
  }

  imageClick () {
    const { container, eventCenter } = this
    const selectionText = node => {
      const textLen = node.textContent.length
      operateClassName(node, 'remove', CLASS_OR_ID['AG_HIDE'])
      operateClassName(node, 'add', CLASS_OR_ID['AG_GRAY'])
      selection.importSelection({
        start: textLen,
        end: textLen
      }, node)
    }

    const handler = event => {
      const target = event.target
      const markedImageText = target.previousElementSibling
      const mathRender = isInElement(target, CLASS_OR_ID['AG_MATH_RENDER'])
      const mathText = mathRender && mathRender.previousElementSibling
      if (markedImageText && markedImageText.classList.contains(CLASS_OR_ID['AG_IMAGE_MARKED_TEXT'])) {
        selectionText(markedImageText)
      } else if (mathText) {
        selectionText(mathText)
      }
    }

    eventCenter.attachDOMEvent(container, 'click', handler)
  }

  htmlPreviewClick () {
    const { eventCenter, container } = this
    const handler = event => {
      const target = event.target
      const htmlPreview = isInElement(target, 'ag-function-html')
      if (htmlPreview && !htmlPreview.classList.contains(CLASS_OR_ID['AG_ACTIVE'])) {
        event.preventDefault()
        event.stopPropagation()
        this.contentState.handleHtmlBlockClick(htmlPreview)
      }
    }

    eventCenter.attachDOMEvent(container, 'click', handler)
  }

  mathPreviewClick () {
    const { eventCenter, container } = this
    const handler = event => {
      const target = event.target
      const mathFigure = isInElement(target, 'ag-multiple-math-block')
      if (mathFigure && !mathFigure.classList.contains(CLASS_OR_ID['AG_ACTIVE'])) {
        event.preventDefault()
        event.stopPropagation()
        this.contentState.handleMathBlockClick(mathFigure)
      }
    }

    eventCenter.attachDOMEvent(container, 'click', handler)
  }

  listItemCheckBoxClick () {
    const { container, eventCenter } = this
    const handler = event => {
      const target = event.target
      if (target.tagName === 'INPUT' && target.classList.contains(CLASS_OR_ID['AG_TASK_LIST_ITEM_CHECKBOX'])) {
        this.contentState.listItemCheckBoxClick(target)
      }
    }

    eventCenter.attachDOMEvent(container, 'click', handler)
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

  async exportStyledHTML () {
    const { markdown } = this
    return new ExportHtml(markdown).generate()
  }

  exportUnstylishHtml () {
    const { markdown } = this
    return exportHtml(markdown)
  }

  getWordCount (markdown) {
    return wordCount(markdown)
  }

  getCursor () {
    return this.contentState.getCodeMirrorCursor()
  }

  clearHistory () {
    this.contentState.history.clearHistory()
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
    const { eventCenter } = this
    this.contentState.createFigure(tableChecker)
    const selectionChanges = this.getSelection()
    eventCenter.dispatch('selectionChange', selectionChanges)
  }

  getSelection () {
    const { fontSize, lineHeight } = this
    return this.contentState.selectionChange(fontSize, lineHeight)
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
    if (name === 'dark') {
      codeMirrorConfig.theme = 'railscasts'
    } else {
      delete codeMirrorConfig.theme
    }
    this.theme = name
    // Render cursor and refresh code block
    this.contentState.render(true, true)
  }

  setFont ({ fontSize, lineHeight }) {
    if (fontSize) this.fontSize = parseInt(fontSize, 10)
    if (lineHeight) this.lineHeight = lineHeight
  }

  setListItemPreference (preferLooseListItem) {
    this.preferLooseListItem = preferLooseListItem
    this.contentState.preferLooseListItem = preferLooseListItem
  }

  setTabSize (tabSize) {
    if (!tabSize || typeof tabSize !== 'number') {
      tabSize = 4
    } else if (tabSize < 1) {
      tabSize = 1
    }
    this.tabSize = tabSize
    this.contentState.tabSize = tabSize
  }

  updateParagraph (type) {
    this.contentState.updateParagraph(type)
  }

  insertParagraph (location) {
    this.contentState.insertParagraph(location)
  }

  editTable (data) {
    this.contentState.editTable(data)
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

  undo () {
    this.contentState.history.undo()
  }

  redo () {
    this.contentState.history.redo()
  }

  copyAsMarkdown () {
    this._copyType = 'copyAsMarkdown'
    document.execCommand('copy')
  }

  copyAsHtml () {
    this._copyType = 'copyAsHtml'
    document.execCommand('copy')
  }

  pasteAsPlainText () {
    this._pasteType = 'pasteAsPlainText'
    document.execCommand('paste')
  }

  copy (name) {
    switch (name) {
      case 'table':
        this._copyType = 'copyTable'
        document.execCommand('copy')
        break
      default:
        break
    }
  }

  destroy () {
    this.emoji.clear() // clear emoji cache for memory recycle
    this.contentState.clear()
    this.floatBox.destroy()
    this.tablePicker.destroy()
    this.container = null
    this.contentState = null
    this.emoji = null
    this.floatBox = null
    this.tablePicker = null
    this.eventCenter.detachAllDomEvents()
    this.eventCenter = null
  }
}

export default Muya
