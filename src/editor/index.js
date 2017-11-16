import {
  updateBlock,
  checkLineBreakUpdate,
  createEmptyElement,
  checkInlineUpdate,
  checkMarkedTextUpdate,
  isAganippeEditorElement,
  findNearestParagraph,
  markedText2Html,
  operateClassName,
  insertBefore,
  insertAfter,
  removeNode,
  isFirstChildElement,
  wrapperElementWithTag,
  nestElementWithTag,
  chopHeader
} from './utils.js'

import {
  keys,
  activeClassName,
  paragraphClassName // eslint-disable-line no-unused-vars
} from './config.js'

import Selection from './selection'
import Event from './event'

const selection = new Selection(document)

class Aganippe {
  constructor (container, options) {
    this.container = container
    this.activeParagraph = null
    this.ids = new Set() // use to store element'id
    this.eventCenter = new Event()
    this.init()
  }
  init () {
    this.ensureContainerDiv()
    const { container, eventCenter } = this
    container.setAttribute('contenteditable', true)
    container.setAttribute('aganippe-editor-element', true)
    container.id = 'write'

    // listen to customEvent `markedTextChange` event, and change markedText to html.
    eventCenter.subscribe('markedTextChange', this.subscribeMarkedText.bind(this))
    this.dispatchMarkedText()

    eventCenter.subscribe('enter', this.subscribeEnter.bind(this))
    this.dispatchEnter()

    eventCenter.subscribe('paragraphChange', this.subscribeParagraphChange.bind(this))
    this.dispatchParagraphChange()

    eventCenter.subscribe('elementUpdate', this.subscribeElementUpdate.bind(this))
    this.dispatchElementUpdate()

    this.dispatchArrow()

    this.handleKeyDown()
    this.generateLastEmptyParagraph()
  }

  ensureContainerDiv () {
    if (this.container.tagName.toLowerCase() === 'div') {
      return false
    }
    const { container } = this
    const div = document.createElement('div')
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
    const emptyElement = createEmptyElement(ids, 'p')
    container.appendChild(emptyElement)
    selection.moveCursor(emptyElement, 0)
    emptyElement.classList.add(activeClassName)
    this.activeParagraph = {
      id: emptyElement.id,
      paragraph: emptyElement
    }
  }
  /**
   * [dispatchMarkedText when input `markedSymbol` or have input `markedSymbol`]
   */
  dispatchMarkedText () {
    const { container, eventCenter } = this
    const changeHandler = event => {
      const node = selection.getSelectionStart()
      const paragraph = findNearestParagraph(node)
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

  dispatchEnter () {
    const { container, eventCenter } = this
    const handleKeyDown = event => {
      if (event.key === keys.Enter) {
        eventCenter.dispatch('enter', event)
      }
    }
    eventCenter.attachDOMEvent(container, 'keydown', handleKeyDown)
  }
  /**
   * [subscribeEnter handler user type `enter|return` key]
   * step 1: detemine tagName
   * step 2: chop markedText
   * step 3: dom manipulate, replacement or insertAfter or inertBefore ...
   * step 4: markedText to html
   * step 5: set cursor
   */
  subscribeEnter (event) {
    event.preventDefault()
    const node = selection.getSelectionStart()
    const paragraph = findNearestParagraph(node)
    const { left, right } = selection.getCaretOffsets(paragraph)
    const preTagName = paragraph.tagName.toLowerCase()
    const attrs = paragraph.attributes

    // step1: detemine tagName
    let tagName
    let newParagraph
    switch (true) {
      case left !== 0 && right !== 0: // cursor at middile of paragraph
        tagName = preTagName
        const { pre, post } = selection.chopHtmlByCursor(paragraph)
        newParagraph = createEmptyElement(this.ids, tagName, attrs)
        paragraph.innerHTML = markedText2Html(pre)
        newParagraph.innerHTML = markedText2Html(post, { start: 0, end: 0 })
        insertAfter(newParagraph, paragraph)
        selection.moveCursor(newParagraph, 0)
        return false
      case left === 0 && right === 0: // paragraph is empty
        if (isFirstChildElement(paragraph) && preTagName === 'li') {
          tagName = 'li'
          newParagraph = createEmptyElement(this.ids, tagName, attrs)
          insertAfter(newParagraph, paragraph)
          selection.moveCursor(newParagraph, 0)
        } else {
          tagName = 'p'
          newParagraph = createEmptyElement(this.ids, tagName, attrs)
          if (preTagName === 'li') {
            // jump out ul
            insertAfter(newParagraph, paragraph.parentNode)
            removeNode(paragraph)
          } else {
            insertAfter(newParagraph, paragraph)
          }
          selection.moveCursor(newParagraph, 0)
        }
        return false
      case left !== 0 && right === 0: // cursor at end of paragraph
      case left === 0 && right !== 0: // cursor at begin of paragraph
        if (preTagName === 'li') tagName = 'li'
        else tagName = 'p' // insert after or before
        newParagraph = createEmptyElement(this.ids, tagName, attrs)
        if (left === 0 && right !== 0) {
          insertBefore(newParagraph, paragraph)
          selection.moveCursor(paragraph, 0)
        } else {
          insertAfter(newParagraph, paragraph)
          selection.moveCursor(newParagraph, 0)
        }
        return false
      default:
        tagName = 'p'
        newParagraph = createEmptyElement(this.ids, tagName, attrs)
        insertAfter(newParagraph, paragraph)
        selection.moveCursor(newParagraph, 0)
        return false
    }
  }

  dispatchElementUpdate () {
    const { container, eventCenter } = this
    const updateHandler = event => {
      const node = selection.getSelectionStart()
      let paragraph = findNearestParagraph(node)
      const selectionState = selection.exportSelection(paragraph)
      const tagName = paragraph.tagName.toLowerCase()
      const text = paragraph.textContent
      const inlineUpdate = checkInlineUpdate(text)
      if (inlineUpdate && inlineUpdate.type !== tagName) {
        eventCenter.dispatch('elementUpdate', inlineUpdate, selectionState, paragraph)
      }
    }

    eventCenter.attachDOMEvent(container, 'input', updateHandler)
  }

  subscribeElementUpdate (inlineUpdate, selectionState, paragraph) {
    const preTagName = paragraph.tagName.toLowerCase()
    const chopedText = chopHeader(paragraph.textContent)
    paragraph.innerHTML = markedText2Html(chopedText)
    let newElement
    if (/^h/.test(inlineUpdate.type)) {
      newElement = updateBlock(paragraph, inlineUpdate.type)
      selection.importSelection(selectionState, newElement)
    } else if (inlineUpdate.type === 'blockquote') {
      if (preTagName === 'p') {
        const { start, end } = selectionState
        newElement = updateBlock(paragraph, inlineUpdate.type)
        nestElementWithTag(newElement, 'p')
        selection.importSelection({ start: start - 1, end: end - 1 }, newElement) // `1` is length of `>`
      } else {
        // TODO li
        const nestElement = nestElementWithTag(paragraph, 'p')
        newElement = wrapperElementWithTag(nestElement, 'blockquote')
      }
    } else if (inlineUpdate.type === 'li') {
      switch (inlineUpdate.info) {
        case 'disorder':
          
          break
        case 'order':
          break
        case 'tasklist':
          break
      }
    }
  }

  dispatchArrow () {
    const { eventCenter, container } = this
    const changeHandler = event => {
      if (event.key) {
        if (
          event.key === keys.ArrowLeft ||
          event.key === keys.ArrowRight ||
          event.key === keys.ArrowUp ||
          event.key === keys.ArrowDown
        ) {
          eventCenter.dispatch('arrow', event)
        }
      }
    }
    eventCenter.attachDOMEvent(container, 'keydown', changeHandler)
  }

  subscribeArrow () {
    // TODO
  }

  dispatchParagraphChange () {
    const { container, eventCenter } = this

    const changeHandler = event => {
      const { id: preId, paragraph: preParagraph } = this.activeParagraph
      const node = selection.getSelectionStart()
      const paragraph = findNearestParagraph(node)
      const newId = paragraph.id
      if (newId !== preId) {
        eventCenter.dispatch('paragraphChange', paragraph, preParagraph)
        this.activeParagraph = {
          id: newId,
          paragraph
        }
      }
    }

    eventCenter.attachDOMEvent(container, 'click', changeHandler)
    eventCenter.subscribe('arrow', changeHandler)
    eventCenter.subscribe('enter', changeHandler)
  }

  subscribeParagraphChange (newParagraph, oldParagraph) {
    console.log(newParagraph.id, oldParagraph.id)
    operateClassName(oldParagraph, 'remove', activeClassName)
    operateClassName(newParagraph, 'add', activeClassName)
    oldParagraph.innerHTML = markedText2Html(oldParagraph.textContent)
  }

  // TODO: refactor
  handleKeyDown () {
    this.container.addEventListener('input', event => {
      // if #write has textNode child, wrap it a `p` tag.
      const node = selection.getSelectionStart()
      if (isAganippeEditorElement(node)) {
        this.doc.execCommand('formatBlock', false, 'p')
      }

      let paragraph = findNearestParagraph(node)
      const tagName = paragraph.tagName.toLowerCase()
      const text = paragraph.textContent
      const linkBreakUpdate = checkLineBreakUpdate(text)
      if (linkBreakUpdate && linkBreakUpdate.type !== tagName) {
        // TODO: update to lineBreak block
      }
    })
  }

  getMarkdown () {
    // TODO
  }
  getHtml () {
    // TODO
  }
  destroy () {
    this.eventCenter.detachAllDomEvents()
    this.ids.clear()
    this.container = null
    this.activeParagraphId = null
    this.eventCenter = null
    this.ids = null
  }
}

export default Aganippe
