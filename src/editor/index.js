import ContentState from './contentState'
import selection from './selection'
import Event from './event'
import { LOWERCASE_TAGS, EVENT_KEYS, CLASS_OR_ID } from './config'
import { throttle, debounce } from './utils'
import { search } from './codeMirror'
import { checkEditLanguage, replaceLanguage } from './codeMirror/language'
import Emoji, { checkEditEmoji, setInlineEmoji } from './emojis'
import FloatBox from './floatBox'
import { findNearestParagraph } from './utils/domManipulate'

class Aganippe {
  constructor (container, options) {
    this.container = container
    this.eventCenter = new Event()
    this.contentState = new ContentState()
    this.emoji = new Emoji(this.eventCenter) // emoji instance: has search(text) clear() methods.
    this.floatBox = new FloatBox(this.eventCenter)
    this.init()
  }

  init () {
    this.ensureContainerDiv()
    const { container, contentState, eventCenter } = this
    contentState.stateRender.setContainer(container.children[0])
    contentState.render()

    eventCenter.subscribe('editEmoji', throttle(this.subscribeEditEmoji.bind(this), 200))
    this.dispatchEditeEmoji()
    eventCenter.subscribe('editLanguage', throttle(this.subscribeEditLanguage.bind(this)))
    this.dispatchEditLanguage()

    eventCenter.subscribe('hideFloatBox', this.subscribeHideFloatBox.bind(this))
    this.dispatchHideFloatBox()

    // if you dont click the keyboard after 1 second, the garbageCollection will run.
    eventCenter.attachDOMEvent(container, 'keydown', debounce(() => this.contentState.garbageCollection(), 1000))

    this.dispatchBackspace()
    this.dispatchEnter()
    this.dispatchUpdateState()
  }

  /**
   * [ensureContainerDiv ensure container element is div]
   */
  ensureContainerDiv () {
    const { container } = this
    const div = document.createElement(LOWERCASE_TAGS.div)
    const rootdom = document.createElement(LOWERCASE_TAGS.div)
    const attrs = container.attributes
    const parentNode = container.parentNode
    // copy attrs from origin container to new div element
    Array.from(attrs).forEach(attr => {
      div.setAttribute(attr.name, attr.value)
    })
    div.setAttribute('contenteditable', true)
    div.appendChild(rootdom)
    parentNode.insertBefore(div, container)
    parentNode.removeChild(container)
    this.container = div
  }

  /**
   * dispatchEditeEmoji
  */
  dispatchEditeEmoji () {
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
          left: `${left}px`, top: `${top + 25 + document.body.scrollTop}px`
        }, cb)
        this.floatBox.setOptions(list)
      } else {
        this.floatBox.hideIfNeeded()
      }
    }
  }

  dispatchHideFloatBox () {
    const { container, eventCenter } = this

    const handler = event => {
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
      replaceLanguage(paragraph, item.mode, selection)
      this.floatBox.hideIfNeeded()
    }
    if (modes.length) {
      this.floatBox.showIfNeeded({
        left: `${left}px`,
        top: `${top + 25 + document.body.scrollTop}px`
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

  dispatchEnter (event) {
    const { container, eventCenter } = this
    const handler = event => {
      if (event.key === EVENT_KEYS.Enter) {
        event.preventDefault()
        this.contentState.enterHandler()
      }
    }

    eventCenter.attachDOMEvent(container, 'keydown', handler)
  }

  dispatchUpdateState () {
    const { container, eventCenter } = this
    let isEditChinese = false
    const changeHandler = event => {
      const target = event.target
      if (event.type === 'click' && target.tagName.toLowerCase() === LOWERCASE_TAGS.hr) {
        return false
      }
      if (event.type === 'compositionstart') {
        isEditChinese = true
        return false
      }
      if (event.type === 'compositionend') {
        isEditChinese = false
      }

      if (!isEditChinese) {
        this.contentState.updateState()
      }
    }

    eventCenter.attachDOMEvent(container, 'click', changeHandler)
    eventCenter.attachDOMEvent(container, 'compositionend', changeHandler)
    eventCenter.attachDOMEvent(container, 'compositionstart', changeHandler)
    eventCenter.attachDOMEvent(container, 'keyup', changeHandler)
  }

  destroy () {
    this.eventCenter.detachAllDomEvents()
    this.emoji.clear() // clear emoji cache for memory recycle
    this.contentState.clear()
    // this.codeBlocks.clear()
    this.container = null
    this.contentState = null
    this.eventCenter = null
    this.emoji = null
    this.floatBox = null
  }
}

export default Aganippe
