import ContentState from './contentState'
import selection from './selection'
import eventCenter from './event'
import { LOWERCASE_TAGS, EVENT_KEYS, CLASS_OR_ID } from './config'
import { throttle, debounce } from './utils'
import { search } from './codeMirror'
import { checkEditLanguage } from './codeMirror/language'
import Emoji, { checkEditEmoji, setInlineEmoji } from './emojis'
import floatBox from './floatBox'
import { findNearestParagraph, operateClassName } from './utils/domManipulate'
import ExportMarkdown from './utils/exportMarkdown'
import ExportStyledHTML from './utils/exportStyledHTML'
import exportHtml from './utils/exportUnstylishHtml'
import tablePicker from './tablePicker'

class Aganippe {
  constructor (container, options) {
    this.container = container
    this.eventCenter = eventCenter
    this.floatBox = floatBox
    this.tablePicker = tablePicker
    this.contentState = new ContentState()
    this.emoji = new Emoji() // emoji instance: has search(text) clear() methods.

    // private property
    this._isEditChinese = false
    this.init()
  }

  init () {
    this.ensureContainerDiv()
    const { container, contentState, eventCenter } = this
    contentState.stateRender.setContainer(container.children[0])
    contentState.render()

    eventCenter.subscribe('editEmoji', throttle(this.subscribeEditEmoji.bind(this), 200))
    this.dispatchEditEmoji()
    eventCenter.subscribe('editLanguage', throttle(this.subscribeEditLanguage.bind(this)))
    this.dispatchEditLanguage()

    eventCenter.subscribe('hideFloatBox', this.subscribeHideFloatBox.bind(this))
    this.dispatchHideFloatBox()

    // if you dont click the keyboard after 1 second, the garbageCollection will run.
    eventCenter.attachDOMEvent(container, 'keydown', debounce(event => {
      this.contentState.historyHandler(event)
      this.contentState.garbageCollection()
      this.dispatchChange()
    }, 300))

    eventCenter.attachDOMEvent(container, 'paste', event => {
      this.contentState.pasteHandler(event)
    })

    this.recordEditChinese()
    this.imageClick()
    this.listItemCheckBoxClick()
    this.dispatchArrow()
    this.dispatchBackspace()
    this.dispatchEnter()
    this.dispatchUpdateState()
    this.dispatchCopyCut()
    this.dispatchTableToolBar()
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
    const markdown = this.getMarkdown()
    const wordCount = this.getWordCount()
    eventCenter.dispatch('change', markdown, wordCount)
  }

  dispatchCopyCut () {
    const { container, eventCenter } = this
    const handler = event => {
      this.contentState.copyCutHandler(event)
      if (event.type === 'cut') {
        // when user use `cut` function, the dom has been deleted by default.
        // But should update content state manually.
        this.contentState.cutHandler()
      }
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
      const { left, top } = emojiNode.getBoundingClientRect()
      const cb = item => {
        setInlineEmoji(emojiNode, item, selection)
        this.floatBox.hideIfNeeded()
      }
      if (list.length) {
        this.floatBox.showIfNeeded({
          left, top
        }, cb)
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

      if (!emojiNode && !lang) {
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
    const { left, top } = paragraph.getBoundingClientRect()
    const modes = search(lang).map(mode => {
      return Object.assign(mode, { text: mode.name })
    })

    const callback = item => {
      this.contentState.selectLanguage(paragraph, item.name)
      this.floatBox.hideIfNeeded()
    }
    if (modes.length) {
      this.floatBox.showIfNeeded({
        left, top
      }, cb || callback)
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

  dispatchTableToolBar () {
    const { container, eventCenter } = this
    const handler = event => {
      const target = event.target
      const parent = target.parentNode
      if (parent && parent.hasAttribute('data-label')) {
        event.preventDefault()
        event.stopPropagation()
        const type = parent.getAttribute('data-label')
        this.contentState.tableToolBarClick(type)
      }
    }

    eventCenter.attachDOMEvent(container, 'click', handler)
  }

  dispatchUpdateState () {
    const { container, eventCenter } = this
    const changeHandler = event => {
      // const target = event.target
      // const style = getComputedStyle(target)
      // if (event.type === 'click' && !style.contenteditable) return
      if (!this._isEditChinese || event.type === 'input') {
        this.contentState.updateState(event)
      }
      if (event.type === 'click' || event.type === 'keyup') {
        const selectionChanges = this.contentState.selectionChange()
        const { formats } = this.contentState.selectionFormats()
        eventCenter.dispatch('selectionChange', selectionChanges)
        eventCenter.dispatch('selectionFormats', formats)
      }
    }

    eventCenter.attachDOMEvent(container, 'click', changeHandler)
    eventCenter.attachDOMEvent(container, 'keyup', changeHandler)
    eventCenter.attachDOMEvent(container, 'input', changeHandler)
  }

  imageClick () {
    const { container, eventCenter } = this
    const handler = event => {
      const target = event.target
      const markedImageText = target.previousElementSibling
      if (markedImageText && markedImageText.classList.contains(CLASS_OR_ID['AG_IMAGE_MARKED_TEXT'])) {
        const textLen = markedImageText.textContent.length
        operateClassName(markedImageText, 'remove', CLASS_OR_ID['AG_HIDE'])
        operateClassName(markedImageText, 'add', CLASS_OR_ID['AG_GRAY'])
        selection.importSelection({
          start: textLen,
          end: textLen
        }, markedImageText)
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

  async exportStyledHTML () {
    const html = await new ExportStyledHTML().generate()
    return html
  }

  exportUnstylishHtml () {
    const blocks = this.contentState.getBlocks()
    const markdown = new ExportMarkdown(blocks).generate()
    return exportHtml(markdown)
  }

  getWordCount () {
    return this.contentState.wordCount()
  }

  setMarkdown (text) {
    this.contentState.importMarkdown(text)
    this.dispatchChange()
  }

  createTable (tableChecker) {
    const { eventCenter } = this
    this.contentState.createFigure(tableChecker)
    const selectionChanges = this.contentState.selectionChange()
    eventCenter.dispatch('selectionChange', selectionChanges)
  }

  updateParagraph (type) {
    this.contentState.updateParagraph(type)
  }

  format (type) {
    this.contentState.format(type)
  }

  on (event, listener) {
    const { eventCenter } = this
    eventCenter.subscribe(event, listener)
  }

  undo () {
    this.contentState.history.undo()
  }

  redo () {
    this.contentState.history.redo()
  }

  destroy () {
    this.eventCenter.detachAllDomEvents()
    this.emoji.clear() // clear emoji cache for memory recycle
    this.contentState.clear()
    this.container = null
    this.contentState = null
    this.eventCenter = null
    this.emoji = null
    this.floatBox = null
  }
}

export default Aganippe
