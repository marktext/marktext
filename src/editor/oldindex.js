import {
  updateBlock, createEmptyElement, findNearestParagraph,
  operateClassName, insertBefore, insertAfter, removeNode, isFirstChildElement,
  wrapperElementWithTag, nestElementWithTag, isOnlyChildElement, isLastChildElement,
  chopBlockQuote, removeAndInsertBefore, removeAndInsertPreList, replaceElement,
  replacementLists, insertBeforeBlockQuote, isAganippeEditorElement,
  findOutMostParagraph, createInputInCodeBlock, isCodeBlockParagraph, hr2P
} from './utils/domManipulate'

import codeMirror, { setMode, search, setCursorAtLastLine,
  isCursorAtFirstLine, isCursorAtLastLine, isCursorAtBegin, // eslint-disable-line no-unused-vars
  isCursorAtEnd, setCursorAtFirstLine, onlyHaveOneLine // eslint-disable-line no-unused-vars
} from './codeMirror'

import FloatBox from './floatBox'

import {
  checkInlineUpdate, checkMarkedTextUpdate, markedText2Html, checkLineBreakUpdate,
  chopHeader, checkEditEmoji, setInlineEmoji, checkBackspaceCase, checkEditLanguage,
  replaceLanguage
} from './syntax'

import {
  throttle,
  debounce
} from './utils'

import {
  CLASS_OR_ID, LOWERCASE_TAGS, EVENT_KEYS, codeMirrorConfig
} from './config'

import Selection from './selection'
import Event from './event'
import Emoji from './emojis'

const selection = new Selection(document)

class Aganippe {
  constructor (container, options) {
    this.container = container
    this.activeParagraph = null
    this.ids = new Set() // use to store element's id
    this.codeBlocks = new Map()
    this.eventCenter = new Event()
    this.emoji = new Emoji(this.eventCenter) // emoji instance: has search(text) clear() methods.
    this.floatBox = new FloatBox(this.eventCenter)
    this.init()
  }

  init () {
    this.ensureContainerDiv()
    const { container, eventCenter } = this

    container.setAttribute('contenteditable', true)
    container.setAttribute(CLASS_OR_ID['AG_EDITOR_ATTR'], true)
    container.classList.add(CLASS_OR_ID['mousetrap']) // for use of mousetrap
    container.id = CLASS_OR_ID['AG_EDITOR_ID']

    // listen to customEvent `markedTextChange` event, and change markedText to html.
    eventCenter.subscribe('markedTextChange', this.subscribeMarkedText.bind(this))
    this.dispatchMarkedText()

    eventCenter.subscribe('editEmoji', throttle(this.subscribeEditEmoji.bind(this), 200))
    this.dispatchEditeEmoji()

    eventCenter.subscribe('paragraphChange', this.subscribeParagraphChange.bind(this))
    this.dispatchParagraphChange()

    eventCenter.subscribe('elementUpdate', this.subscribeElementUpdate.bind(this))
    this.dispatchElementUpdate()
    eventCenter.subscribe('editLanguage', throttle(this.subscribeEditLanguage.bind(this)))
    this.dispatchEditLanguage()

    eventCenter.subscribe('hideFloatBox', this.subscribeHideFloatBox.bind(this))
    this.dispatchHideFloatBox()

    eventCenter.bind('enter', this.enterKeyHandler.bind(this))

    eventCenter.subscribe('backspace', this.backspaceHandler.bind(this))
    this.dispatchBackspace()

    eventCenter.subscribe('arrow', this.arrowHander.bind(this))
    this.dispatchArrow()
    // if you dont click the keyboard after 1 second, the garbageCollection will run.
    eventCenter.attachDOMEvent(container, 'keydown', debounce(this.garbageCollection.bind(this), 1000))

    this.handlerSelectHr()
    this.imageClick()
    this.generateLastEmptyParagraph()
  }

  // add handler to select hr element. and translate it to a p element
  handlerSelectHr () {
    const { container, eventCenter } = this
    let newElement
    const changeHr2P = (event, target, preParagraph) => {
      newElement = hr2P(target, selection)
      // todo need remove below ?
      this.activeParagraph = {
        id: newElement.id,
        paragraph: newElement
      }
      eventCenter.dispatch('paragraphChange', newElement, preParagraph, false)
      event.preventDefault()
    }

    const handler = event => {
      switch (event.type) {
        case 'click': {
          const target = event.target
          if (target.tagName.toLowerCase() === LOWERCASE_TAGS.hr) {
            changeHr2P(event, target, this.activeParagraph.paragraph)
          }
          break
        }
        case 'keydown': {
          const node = selection.getSelectionStart()
          const outmostParagraph = findOutMostParagraph(node)
          const preSibling = outmostParagraph.previousElementSibling
          const nextSibling = outmostParagraph.nextElementSibling
          // if the out most paragraph is pre element. handle over this to `arrow` event.
          if (outmostParagraph.tagName.toLowerCase() === LOWERCASE_TAGS.pre) return
          if (
            event.key === EVENT_KEYS.ArrowUp &&
            preSibling &&
            preSibling.tagName.toLowerCase() === LOWERCASE_TAGS.hr
          ) {
            changeHr2P(event, preSibling, outmostParagraph)
          }
          if (
            event.key === EVENT_KEYS.ArrowDown &&
            nextSibling &&
            nextSibling.tagName.toLowerCase() === LOWERCASE_TAGS.hr
          ) {
            changeHr2P(event, nextSibling, outmostParagraph)
          }
          break
        }
      }
    }

    eventCenter.attachDOMEvent(container, 'keydown', handler)
    eventCenter.attachDOMEvent(container, 'click', handler)
  }

  dispatchParagraphChange () {
    const { container, eventCenter } = this

    const changeHandler = event => {
      const { id: preId, paragraph: preParagraph } = this.activeParagraph
      let node = selection.getSelectionStart()
      if (isAganippeEditorElement(node)) {
        event.preventDefault()
        return false
      }
      // handle click img
      if (event.type === 'click') {
        const target = event.target
        if (target.tagName.toLowerCase() === LOWERCASE_TAGS.img) {
          node = target
        }
      }
      let paragraph = findNearestParagraph(node)
      if (paragraph.tagName.toLowerCase() === LOWERCASE_TAGS.li) {
        paragraph = paragraph.children[0]
      }

      const id = paragraph.id
      if (id !== preId) {
        const autoFocus = event.key && event.key === EVENT_KEYS.Enter
        eventCenter.dispatch('paragraphChange', paragraph, preParagraph, autoFocus)
      }
    }

    eventCenter.attachDOMEvent(container, 'click', changeHandler)
    eventCenter.attachDOMEvent(container, 'keyup', changeHandler)
  }
  // newParagrpha and oldParagraph must be h1~6\p\pre element. can not be `li` or `blockquote`
  subscribeParagraphChange (newParagraph, oldParagraph, autofocus) {
    const { eventCenter, ids } = this
    const oldContext = oldParagraph.textContent
    const oldTagName = oldParagraph.tagName.toLowerCase()
    const lineBreakUpdate = checkLineBreakUpdate(oldContext)

    if (oldParagraph.classList.contains(CLASS_OR_ID['AG_TEMP'])) {
      if (!oldContext) {
        removeNode(oldParagraph)
      } else {
        operateClassName(oldParagraph, 'remove', CLASS_OR_ID['AG_TEMP'])
      }
    } else if (lineBreakUpdate && oldTagName !== lineBreakUpdate.type) {
      switch (lineBreakUpdate.type) {
        case LOWERCASE_TAGS.pre: {
          // exchange of newParagraph and oldParagraph
          const codeMirrorWrapper = updateBlock(oldParagraph, lineBreakUpdate.type)
          operateClassName(codeMirrorWrapper, 'add', CLASS_OR_ID['AG_CODE_BLOCK'])

          codeMirrorWrapper.innerHTML = ''
          const config = Object.assign(codeMirrorConfig, {
            autofocus
          })
          const codeBlock = codeMirror(codeMirrorWrapper, config)
          const input = createInputInCodeBlock(codeMirrorWrapper)

          const handler = langMode => {
            const { mode } = langMode
            setMode(codeBlock, mode)
              .then(mode => {
                codeMirrorWrapper.setAttribute('lang', mode.name)
                input.value = mode.name
                input.blur()
                setCursorAtLastLine(codeBlock)
              })
              .catch(err => {
                console.warn(err)
              })
            this.floatBox.hideIfNeeded()
          }

          handler({mode: lineBreakUpdate.info})

          eventCenter.attachDOMEvent(input, 'keyup', () => {
            const value = input.value
            eventCenter.dispatch('editLanguage', input, value.trim(), handler)
          })

          if (!isLastChildElement(newParagraph) && autofocus) {
            removeNode(newParagraph)
          }
          if (autofocus) {
            operateClassName(codeMirrorWrapper, 'add', CLASS_OR_ID['AG_ACTIVE'])
            this.activeParagraph = {
              id: codeMirrorWrapper.id,
              paragraph: codeMirrorWrapper
            }
          }
          this.codeBlocks.set(codeMirrorWrapper.id, codeBlock)
          return false
        }
        case LOWERCASE_TAGS.hr: {
          oldParagraph = updateBlock(oldParagraph, LOWERCASE_TAGS.hr)
          break
        }
      }
    } else {
      if (oldContext && oldTagName !== LOWERCASE_TAGS.pre) {
        oldParagraph.innerHTML = markedText2Html(ids, oldParagraph.textContent)
      }
    }
    // set and remove active className
    if (oldParagraph) {
      operateClassName(oldParagraph, 'remove', CLASS_OR_ID['AG_ACTIVE'])
    }
    if (newParagraph) {
      operateClassName(newParagraph, 'add', CLASS_OR_ID['AG_ACTIVE'])
      this.activeParagraph = {
        id: newParagraph.id,
        paragraph: newParagraph
      }
    }
  }

  // dispach arrow event
  dispatchArrow () {
    const { container, eventCenter } = this
    const handler = event => {
      switch (event.key) {
        case EVENT_KEYS.ArrowUp: // fallthrough
        case EVENT_KEYS.ArrowDown: // fallthrough
        case EVENT_KEYS.ArrowLeft: // fallthrough
        case EVENT_KEYS.ArrowRight: // fallthrough
          eventCenter.dispatch('arrow', event)
          break
      }
    }
    eventCenter.attachDOMEvent(container, 'keydown', handler)
  }

  arrowHander (event) {
    // when the float box is show, use up and down to select item.
    const { list, index, show } = this.floatBox
    const node = selection.getSelectionStart()
    const paragraph = findNearestParagraph(node)
    console.log(node)
    const outMostParagraph = findOutMostParagraph(node)
    const { left, right } = selection.getCaretOffsets(paragraph)
    let preParagraph = outMostParagraph.previousElementSibling
    let nextParagraph = outMostParagraph.nextElementSibling
    if (show && (event.key === EVENT_KEYS.ArrowUp || event.key === EVENT_KEYS.ArrowDown)) {
      event.preventDefault()
      switch (event.key) {
        case EVENT_KEYS.ArrowDown:
          if (index < list.length - 1) {
            this.floatBox.setOptions(list, index + 1)
          }
          break
        case EVENT_KEYS.ArrowUp:
          if (index > 0) {
            this.floatBox.setOptions(list, index - 1)
          }
          break
      }
    } else if (isCodeBlockParagraph(paragraph)) {
      // handle cursor in code block. the case at firstline or lastline.
      const codeBlockId = paragraph.id
      const cm = this.codeBlocks.get(codeBlockId)

      event.preventDefault()
      switch (event.key) {
        case EVENT_KEYS.ArrowLeft: // fallthrough
        case EVENT_KEYS.ArrowUp:
          if (
            (event.key === EVENT_KEYS.ArrowUp && isCursorAtFirstLine(cm) && preParagraph) ||
            (event.key === EVENT_KEYS.ArrowLeft && isCursorAtBegin(cm) && preParagraph)
          ) {
            if (isCodeBlockParagraph(preParagraph)) {
              const newParagraph = createEmptyElement(this.ids, LOWERCASE_TAGS.p)
              operateClassName(newParagraph, 'add', CLASS_OR_ID['AG_TEMP'])
              insertAfter(newParagraph, preParagraph)
              preParagraph = newParagraph
            }

            if (preParagraph.tagName.toLowerCase() === LOWERCASE_TAGS.hr) {
              hr2P(preParagraph, selection)
            } else {
              selection.importSelection({
                start: preParagraph.textContent.length,
                end: preParagraph.textContent.length
              }, preParagraph)
            }
          }
          break
        case EVENT_KEYS.ArrowRight: // fallthrough
        case EVENT_KEYS.ArrowDown:
          if (
            (event.key === EVENT_KEYS.ArrowDown && isCursorAtLastLine(cm) && nextParagraph) ||
            (event.key === EVENT_KEYS.ArrowRight && isCursorAtEnd(cm) && nextParagraph)
          ) {
            if (isCodeBlockParagraph(nextParagraph)) {
              const newParagraph = createEmptyElement(this.ids, LOWERCASE_TAGS.p)
              operateClassName(newParagraph, 'add', CLASS_OR_ID['AG_TEMP'])
              insertBefore(newParagraph, nextParagraph)
              nextParagraph = newParagraph
            }
            if (nextParagraph.tagName.toLowerCase() === LOWERCASE_TAGS.hr) {
              hr2P(nextParagraph, selection)
            } else {
              selection.importSelection({
                start: 0,
                end: 0
              }, nextParagraph)
            }
          } else if (!nextParagraph) {
            const newParagraph = createEmptyElement(this.ids, LOWERCASE_TAGS.p)
            insertAfter(newParagraph, paragraph)
            selection.moveCursor(newParagraph, 0)
          }
          break
      }
    } else if (
      (isCodeBlockParagraph(preParagraph) && event.key === EVENT_KEYS.ArrowUp) ||
      (isCodeBlockParagraph(preParagraph) && event.key === EVENT_KEYS.ArrowLeft && left === 0)
    ) {
      event.preventDefault()
      const codeBlockId = preParagraph.id
      const cm = this.codeBlocks.get(codeBlockId)
      return setCursorAtLastLine(cm)
    } else if (
      (isCodeBlockParagraph(nextParagraph) && event.key === EVENT_KEYS.ArrowDown) ||
      (isCodeBlockParagraph(nextParagraph) && event.key === EVENT_KEYS.ArrowRight && right === 0)
    ) {
      event.preventDefault()
      const codeBlockId = nextParagraph.id
      const cm = this.codeBlocks.get(codeBlockId)
      return setCursorAtFirstLine(cm)
    }
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


  getMarkdown () {
    // TODO
  }
  getHtml () {
    // TODO
  }

}

export default Aganippe
