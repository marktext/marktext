import {
  updateBlock, createEmptyElement, findNearestParagraph,
  operateClassName, insertBefore, insertAfter, removeNode, isFirstChildElement,
  wrapperElementWithTag, nestElementWithTag, isOnlyChildElement, isLastChildElement,
  chopBlockQuote, removeAndInsertBefore, removeAndInsertPreList, replaceElement,
  replacementLists, insertBeforeBlockQuote, isAganippeEditorElement,
  findOutMostParagraph
} from './utils/domManipulate'

import codeMirror from './codeMirror'

import {
  checkInlineUpdate, checkMarkedTextUpdate, markedText2Html, checkLineBreakUpdate,
  chopHeader, checkEditEmoji, setInlineEmoji, checkBackspaceCase
} from './syntax'

import {
  throttle
} from './utils'

import {
  CLASS_OR_ID, LOWERCASE_TAGS, EVENT_KEYS
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
    this.init()
  }

  init () {
    this.ensureContainerDiv()
    const { container, eventCenter } = this

    container.setAttribute('contenteditable', true)
    container.setAttribute(CLASS_OR_ID['AG_EDITOR_ATTR'], true)
    container.classList.add('mousetrap') // for use of mousetrap
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

    eventCenter.bind('enter', this.enterKeyHandler.bind(this))
    eventCenter.bind('backspace', this.backspaceKeyHandler.bind(this))

    this.handlerSelectHr()

    this.generateLastEmptyParagraph()
  }
  /**
   * [ensureContainerDiv ensure container element is div]
   */
  ensureContainerDiv () {
    if (this.container.tagName.toLowerCase() === LOWERCASE_TAGS.div) {
      return false
    }
    const { container } = this
    const div = document.createElement(LOWERCASE_TAGS.div)
    const attrs = container.attributes
    const parentNode = container.parentNode
    // copy attrs from origin container to new div element
    Array.from(attrs).forEach(attr => {
      div.setAttribute(attr.name, attr.value)
    })
    parentNode.insertBefore(div, container)
    parentNode.removeChild(container)
    this.container = div
  }

  generateLastEmptyParagraph () {
    const { ids, container } = this
    const emptyElement = createEmptyElement(ids, LOWERCASE_TAGS.p)

    container.appendChild(emptyElement)
    selection.moveCursor(emptyElement, 0)
    emptyElement.classList.add(CLASS_OR_ID['AG_ACTIVE'])
    this.activeParagraph = {
      id: emptyElement.id,
      paragraph: emptyElement
    }
  }
  /**
   * dispatchEditeEmoji
   */
  dispatchEditeEmoji () {
    const { container, eventCenter } = this
    const changeHandler = event => {
      const target = event.target
      if (event.type === 'click' && target.tagName.toLowerCase() === LOWERCASE_TAGS.hr) {
        return false
      }
      const node = selection.getSelectionStart()
      Promise.resolve()
        .then(() => {
          const isEdit = checkEditEmoji(event, node)
          eventCenter.dispatch('editEmoji', node, isEdit)
        })
    }
    eventCenter.attachDOMEvent(container, 'click', changeHandler)
    eventCenter.attachDOMEvent(container, 'keyup', changeHandler)
  }
  subscribeEditEmoji (node, isEdit) {
    const emojiNode = node.classList.contains(CLASS_OR_ID['AG_EMOJI_MARKED_TEXT']) ? node : node.previousElementSibling
    const text = emojiNode ? emojiNode.textContent.trim() : ''
    if (!isEdit || !text) {
      this.emoji.box.hideIfNeeded()
    } else {
      const list = this.emoji.search(text).slice(0, 5)
      const { left, top } = emojiNode.getBoundingClientRect()
      const cb = index => {
        const selectEmoji = list[index]
        setInlineEmoji(emojiNode, selectEmoji, selection)
        this.emoji.box.hideIfNeeded()
      }
      if (list.length) {
        const activeIndex = 0
        this.emoji.box.showIfNeeded()
        this.emoji.box.setOptions(list, activeIndex, {
          left: `${left}px`, top: `${top + 35}px`
        }, cb)
      } else {
        this.emoji.box.hideIfNeeded()
      }
    }
  }
  /**
   * [dispatchMarkedText when input `markedSymbol` or have input `markedSymbol`]
   */
  dispatchMarkedText () {
    const { container, eventCenter } = this
    const changeHandler = event => {
      const target = event.target
      if (event.type === 'click' && target.tagName.toLowerCase() === LOWERCASE_TAGS.hr) {
        return false
      }
      const node = selection.getSelectionStart()
      const paragraph = findNearestParagraph(node)
      // TODO handle code change and history
      const text = paragraph.textContent
      const html = paragraph.innerHTML
      const selectionState = selection.exportSelection(paragraph)
      if (checkMarkedTextUpdate(html, text, selectionState)) {
        eventCenter.dispatch('markedTextChange', paragraph, selectionState)
      }
    }
    eventCenter.attachDOMEvent(container, 'click', changeHandler)
    eventCenter.attachDOMEvent(container, 'keyup', changeHandler)
  }
  /**
   * [subscribeMarkedText change markedText to html, and reset the cursor]
   */
  subscribeMarkedText (paragraph, selectionState) {
    const text = paragraph.textContent
    const markedHtml = markedText2Html(text, selectionState)
    paragraph.innerHTML = markedHtml
    selection.importSelection(selectionState, paragraph)
  }
  /**
   * [enterKeyHandler handler user type `enter|return` key]
   * step 1: detemine tagName
   * step 2: chop markedText
   * step 3: dom manipulate, replacement or insertAfter or inertBefore ...
   * step 4: markedText to html
   * step 5: set cursor
   */

  dispatchElementUpdate () {
    const { container, eventCenter } = this
    const updateHandler = event => {
      const node = selection.getSelectionStart()
      let paragraph = findNearestParagraph(node)
      const selectionState = selection.exportSelection(paragraph)
      const tagName = paragraph.tagName.toLowerCase()
      const text = paragraph.textContent
      const inlineUpdate = checkInlineUpdate(text)

      if (inlineUpdate && inlineUpdate.type !== tagName && tagName !== LOWERCASE_TAGS.pre) {
        eventCenter.dispatch('elementUpdate', inlineUpdate, selectionState, paragraph)
      }
    }

    eventCenter.attachDOMEvent(container, 'input', updateHandler)
  }

  subscribeElementUpdate (inlineUpdate, selectionState, paragraph) {
    const { start, end } = selectionState
    const preTagName = paragraph.tagName.toLowerCase()
    const markedText = paragraph.textContent
    const chopedText = chopHeader(markedText)
    const chopedLength = markedText.length - chopedText.length
    paragraph.innerHTML = markedText2Html(chopedText)
    let newElement

    if (/^(h|p)/.test(inlineUpdate.type)) {
      newElement = updateBlock(paragraph, inlineUpdate.type)
      selection.importSelection(selectionState, newElement)
    } else if (inlineUpdate.type === LOWERCASE_TAGS.blockquote) {
      if (preTagName === LOWERCASE_TAGS.p) {
        newElement = updateBlock(paragraph, inlineUpdate.type)
        // ensure newElement is innermost p element.
        newElement = nestElementWithTag(this.ids, newElement, LOWERCASE_TAGS.p).children[0]
        selection.importSelection({
          start: start - chopedLength,
          end: end - chopedLength
        }, newElement)
      } else {
        console.warn(`${preTagName} element can not update to [blockquote] element`)
      }
    } else if (inlineUpdate.type === LOWERCASE_TAGS.li) {
      switch (inlineUpdate.info) {
        case 'order': // fallthrough
        case 'disorder':
          // first change `p` to 'li'.
          newElement = updateBlock(paragraph, inlineUpdate.type)
          // second put a p element in li.
          newElement = nestElementWithTag(this.ids, newElement, LOWERCASE_TAGS.p)
          const id = newElement.querySelector(LOWERCASE_TAGS.p).id
          const altTagName = inlineUpdate.info === 'order' ? LOWERCASE_TAGS.ol : LOWERCASE_TAGS.ul
          const parentNode = newElement.parentNode
          const parentTagName = parentNode.tagName.toLowerCase()
          const previousElement = newElement.previousElementSibling
          const preViousTagName = previousElement && previousElement.tagName.toLowerCase()

          if (parentTagName !== altTagName && preViousTagName !== altTagName) {
            newElement = wrapperElementWithTag(this.ids, newElement, altTagName)
          }
          if (preViousTagName === altTagName) {
            previousElement.appendChild(newElement)
          }
          newElement = newElement.querySelector(`#${id}`)
          selection.importSelection({
            start: start - chopedLength,
            end: end - chopedLength
          }, newElement)
          break

        case 'tasklist':
          // TODO
          break
      }
    }
    this.activeParagraph = {
      id: newElement.id,
      paragraph: newElement
    }
  }
  // add handler to select hr element. and translate it to a p element
  handlerSelectHr () {
    const { container, eventCenter } = this
    let newElement
    const changeHr2P = (event, target, preParagraph) => {
      newElement = updateBlock(target, LOWERCASE_TAGS.p)
      newElement.textContent = '---'
      selection.importSelection({
        start: 3,
        end: 3
      }, newElement)
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
      const node = selection.getSelectionStart()
      if (isAganippeEditorElement(node)) {
        event.preventDefault()
        return false
      }
      let paragraph = findNearestParagraph(node)
      if (paragraph.tagName.toLowerCase() === LOWERCASE_TAGS.li) {
        paragraph = paragraph.children[0]
      }

      const id = paragraph.id
      if (id !== preId) {
        const autoFocus = event.key && event.key === EVENT_KEYS.Enter
        eventCenter.dispatch('paragraphChange', paragraph, preParagraph, autoFocus)
        this.activeParagraph = {
          id,
          paragraph
        }
      }
    }

    eventCenter.attachDOMEvent(container, 'click', changeHandler)
    eventCenter.attachDOMEvent(container, 'keyup', changeHandler)
  }
  // newParagrpha and oldParagraph must be h1~6\p\pre element. can not be `li` or `blockquote`
  subscribeParagraphChange (newParagraph, oldParagraph, autofocus) {
    const oldContext = oldParagraph.textContent
    const oldTagName = oldParagraph.tagName.toLowerCase()
    const lineBreakUpdate = checkLineBreakUpdate(oldContext)
    if (lineBreakUpdate && oldTagName !== lineBreakUpdate.type) {
      switch (lineBreakUpdate.type) {
        case LOWERCASE_TAGS.pre: {
          // exchange of newParagraph and oldParagraph

          const codeMirrorWrapper = updateBlock(oldParagraph, lineBreakUpdate.type)
          operateClassName(codeMirrorWrapper, 'add', CLASS_OR_ID['AG_CODE_BLOCK'])
          codeMirrorWrapper.innerHTML = ''
          const codeBlock = codeMirror(codeMirrorWrapper, {
            autofocus
          })
          if (!isLastChildElement(newParagraph) && autofocus) {
            removeNode(newParagraph)
          }

          this.codeBlocks.set(codeMirrorWrapper.id, codeBlock)
          break
        }
        case LOWERCASE_TAGS.hr: {
          oldParagraph = updateBlock(oldParagraph, LOWERCASE_TAGS.hr)
          break
        }
      }
    } else {
      if (oldContext && oldTagName !== LOWERCASE_TAGS.pre) {
        oldParagraph.innerHTML = markedText2Html(oldParagraph.textContent)
      }
    }
    // set and remove active className
    operateClassName(oldParagraph, 'remove', CLASS_OR_ID['AG_ACTIVE'])
    operateClassName(newParagraph, 'add', CLASS_OR_ID['AG_ACTIVE'])
  }
  // handler `enter` key event.
  enterKeyHandler (event) {
    event.preventDefault()
    const node = selection.getSelectionStart()
    let paragraph = findNearestParagraph(node)
    const parentNode = paragraph.parentNode
    const parTagName = parentNode.tagName.toLowerCase()
    if (parTagName === LOWERCASE_TAGS.li && isFirstChildElement(paragraph)) {
      paragraph = parentNode
    }
    const { left, right } = selection.getCaretOffsets(paragraph)
    const preTagName = paragraph.tagName.toLowerCase()
    const attrs = paragraph.attributes

    // step1: detemine tagName
    let tagName
    let newParagraph
    switch (true) {
      case left !== 0 && right !== 0: // cursor at middile of paragraph
        tagName = preTagName
        let { pre, post } = selection.chopHtmlByCursor(paragraph)
        newParagraph = createEmptyElement(this.ids, tagName)

        if (/^h/.test(tagName)) {
          const PREFIX = /^#+/.exec(pre)[0]
          post = `${PREFIX}${post}`
          newParagraph.setAttribute('data-head-level', attrs['data-head-level'].value)
        }

        if (tagName === LOWERCASE_TAGS.li) {
          paragraph.children[0].innerHTML = markedText2Html(pre)
          newParagraph.children[0].innerHTML = markedText2Html(post, { start: 0, end: 0 })
        } else {
          paragraph.innerHTML = markedText2Html(pre)
          newParagraph.innerHTML = markedText2Html(post, { start: 0, end: 0 })
        }
        insertAfter(newParagraph, paragraph)
        break
      case left === 0 && right === 0: // paragraph is empty
        if (parTagName === LOWERCASE_TAGS.blockquote) {
          return this.enterInImptyBlockquote(paragraph)
        }
        if (isFirstChildElement(paragraph) && preTagName === LOWERCASE_TAGS.li) {
          tagName = preTagName
          newParagraph = createEmptyElement(this.ids, tagName)
          insertAfter(newParagraph, paragraph)
        } else if (parTagName === LOWERCASE_TAGS.li) {
          tagName = parTagName
          newParagraph = createEmptyElement(this.ids, tagName)
          insertAfter(newParagraph, parentNode)
          removeNode(paragraph)
        } else {
          tagName = LOWERCASE_TAGS.p
          newParagraph = createEmptyElement(this.ids, tagName)
          if (preTagName === LOWERCASE_TAGS.li) {
            // jump out ul
            insertAfter(newParagraph, parentNode)
            removeNode(paragraph)
          } else {
            insertAfter(newParagraph, paragraph)
          }
        }
        break
      case left !== 0 && right === 0: // cursor at end of paragraph
      case left === 0 && right !== 0: // cursor at begin of paragraph
        if (preTagName === LOWERCASE_TAGS.li) tagName = preTagName
        else tagName = LOWERCASE_TAGS.p // insert after or before
        newParagraph = createEmptyElement(this.ids, tagName)
        if (left === 0 && right !== 0) {
          insertBefore(newParagraph, paragraph)
        } else {
          insertAfter(newParagraph, paragraph)
        }
        break
      default:
        tagName = LOWERCASE_TAGS.p
        newParagraph = createEmptyElement(this.ids, tagName)
        insertAfter(newParagraph, paragraph)
        break
    }
    if (left === 0 && right !== 0) {
      selection.moveCursor(paragraph, 0)
    } else {
      selection.moveCursor(newParagraph, 0)
    }
  }
  /**
   * [subscribeBackspace]
   * description: need to handle these cases:
   * 1. cursor at begining of list
   * 2. cursor at begining of blockquote whick has only one p element
   * 3. no text in editor
   */
  backspaceKeyHandler (event) {
    const node = selection.getSelectionStart()
    const paragraph = findNearestParagraph(node)
    const selectionState = selection.exportSelection(paragraph)
    const inlineDegrade = checkBackspaceCase(node, selection)
    let newElement
    if (inlineDegrade) {
      event.preventDefault()
      switch (inlineDegrade.type) {
        case 'STOP':
          // do nothing...
          break
        case 'LI': {
          if (inlineDegrade.info === 'REPLACEMENT') {
            newElement = replacementLists(paragraph)
          } else if (inlineDegrade.info === 'REMOVE_INSERT_BEFORE') {
            newElement = removeAndInsertBefore(paragraph)
          } else if (inlineDegrade.info === 'INSERT_PRE_LIST') {
            newElement = removeAndInsertPreList(paragraph)
          }
          break
        }
        case 'BLOCKQUOTE':
          if (inlineDegrade.info === 'REPLACEMENT') {
            newElement = replaceElement(paragraph, paragraph.parentNode)
          } else if (inlineDegrade.info === 'INSERT_BEFORE') {
            newElement = insertBeforeBlockQuote(paragraph)
          }
          break
      }
      if (newElement) {
        selection.importSelection(selectionState, newElement)
      }
    }
  }

  enterInImptyBlockquote (paragraph) {
    const newParagraph = createEmptyElement(this.ids, LOWERCASE_TAGS.p)
    const parentNode = paragraph.parentNode
    if (isOnlyChildElement(paragraph)) {
      insertAfter(newParagraph, parentNode)
      removeNode(parentNode)
    } else if (isFirstChildElement(paragraph)) {
      insertBefore(newParagraph, parentNode)
    } else if (isLastChildElement(paragraph)) {
      insertAfter(newParagraph, parentNode)
    } else {
      chopBlockQuote(this.ids, paragraph)
      const preBlockQuote = paragraph.parentNode
      insertAfter(newParagraph, preBlockQuote)
    }
    removeNode(paragraph)
    selection.moveCursor(newParagraph, 0)
  }

  getMarkdown () {
    // TODO
  }
  getHtml () {
    // TODO
  }

  destroy () {
    this.eventCenter.detachAllDomEvents()
    this.emoji.clear() // clear emoji cache for memory recycle
    this.ids.clear()
    this.codeBlocks.clear()
    this.container = null
    this.activeParagraphId = null
    this.eventCenter = null
    this.ids = null
  }
}

export default Aganippe
