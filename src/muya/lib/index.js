import ContentState from './contentState'
import selection from './selection'
import EventCenter from './eventHandler/event'
import Clipboard from './eventHandler/clipboard'
import Keyboard from './eventHandler/keyboard'
import ClickEvent from './eventHandler/clickEvent'
import { EVENT_KEYS, CLASS_OR_ID, codeMirrorConfig } from './config'
import { throttle, wordCount } from './utils'
import { search } from './codeMirror'
import { checkEditLanguage } from './codeMirror/language'
import Emoji, { checkEditEmoji, setInlineEmoji } from './emojis'
import FloatBox from './ui/floatBox'
import { findNearestParagraph } from './selection/dom'
import ExportMarkdown from './utils/exportMarkdown'
import ExportHtml from './utils/exportHtml'
import { checkEditImage } from './utils/checkEditImage'
import TablePicker from './ui/tablePicker'
import ToolTip from './ui/tooltip'
import QuickInsert from './ui/quickInsert'

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
    this.container = getContainer(container)
    this.emoji = new Emoji() // emoji instance: has search(text) clear() methods.
    this.eventCenter = new EventCenter()
    this.tooltip = new ToolTip(this)
    this.quickInsert = new QuickInsert(this)
    this.floatBox = new FloatBox(this)
    this.tablePicker = new TablePicker(this)
    this.contentState = new ContentState(this, {
      preferLooseListItem,
      autoPairBracket,
      autoPairMarkdownSyntax,
      autoPairQuote,
      bulletListMarker,
      tabSize
    })
    this.clipboard = new Clipboard(this)
    this.clickEvent = new ClickEvent(this)
    this.keyboard = new Keyboard(this)
    this.focusMode = focusMode
    this.theme = theme
    this.markdown = markdown
    this.fontSize = 16
    this.lineHeight = 1.6
    this.init()
  }

  init () {
    const { container, contentState, eventCenter } = this
    contentState.stateRender.setContainer(container.children[0])

    eventCenter.subscribe('editEmoji', throttle(this.subscribeEditEmoji.bind(this), 200))
    this.dispatchEditEmoji()
    eventCenter.subscribe('editLanguage', throttle(this.subscribeEditLanguage.bind(this)))
    this.dispatchEditLanguage()

    eventCenter.subscribe('hideFloatBox', this.subscribeHideFloatBox.bind(this))
    this.dispatchHideFloatBox()

    eventCenter.subscribe('stateChange', this.dispatchChange.bind(this))

    eventCenter.attachDOMEvent(container, 'contextmenu', event => {
      event.preventDefault()
      event.stopPropagation()
      const sectionChanges = this.contentState.selectionChange(undefined, undefined, this.contentState.cursor)
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

  focus () {
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
