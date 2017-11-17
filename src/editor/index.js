import {
  updateBlock, checkLineBreakUpdate, createEmptyElement, checkInlineUpdate, checkMarkedTextUpdate,
  isAganippeEditorElement, findNearestParagraph, markedText2Html, operateClassName, insertBefore,
  insertAfter, removeNode, isFirstChildElement, wrapperElementWithTag, nestElementWithTag, chopHeader,
  isOnlyChildElement, isLastChildElement, chopBlockQuote, checkEditEmoji, setInlineEmoji, throttle
} from './utils'

import {
  EVENT_KEYS, LOWERCASE_TAGS, EDITOR_ATTR_NAME, EDITOR_ID, activeClassName, EMOJI_MARKED_TEXT
} from './config'

import Selection from './selection'
import Event from './event'
import Emoji from './emojis'

const selection = new Selection(document)

class Aganippe {
  constructor (container, options) {
    this.container = container
    this.activeParagraph = null
    this.ids = new Set() // use to store element'id
    this.eventCenter = new Event()
    this.emoji = new Emoji(this.eventCenter) // emoji instance: has search(text) clear() methods.
    this.init()
  }

  init () {
    this.ensureContainerDiv()
    const { container, eventCenter } = this

    container.setAttribute('contenteditable', true)
    container.setAttribute(EDITOR_ATTR_NAME, true)
    container.id = EDITOR_ID

    // listen to customEvent `markedTextChange` event, and change markedText to html.
    eventCenter.subscribe('markedTextChange', this.subscribeMarkedText.bind(this))
    this.dispatchMarkedText()

    eventCenter.subscribe('editEmoji', throttle(this.subscribeEditEmoji.bind(this)))
    this.dispatchEditeEmoji()

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
    emptyElement.classList.add(activeClassName)
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
      const node = selection.getSelectionStart()
      const paragraph = findNearestParagraph(node)
      const html = paragraph.innerHTML
      Promise.resolve()
        .then(() => {
          const action = checkEditEmoji(html)
          eventCenter.dispatch('editEmoji', node, action)
        })
    }
    eventCenter.attachDOMEvent(container, 'click', changeHandler)
    eventCenter.attachDOMEvent(container, 'keyup', changeHandler)
  }
  subscribeEditEmoji (node, action) {
    if (action === 'hide') this.emoji.box.hideIfNeeded()
    if (node.classList.contains(EMOJI_MARKED_TEXT)) {
      const text = node.textContent.replace(/:/g, '')
      if (!text) return false
      const list = this.emoji.search(text)
      const { left, top } = node.getBoundingClientRect()
      const cb = index => {
        console.log(index)
        const selectEmoji = list[index]
        setInlineEmoji(node, selectEmoji, selection)
        this.emoji.box.hideIfNeeded()
      }
      if (list.length) {
        list[0].active = true
        this.emoji.box.showIfNeeded()
        this.emoji.box.setOptions(list, { left: `${left}px`, top: `${top + 35}px` }, cb)
      } else {
        this.emoji.box.hideIfNeeded()
      }
    } else {
      this.emoji.box.hideIfNeeded()
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
      if (event.key === EVENT_KEYS.Enter) {
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
        const { pre, post } = selection.chopHtmlByCursor(paragraph)
        newParagraph = createEmptyElement(this.ids, tagName, attrs)
        if (tagName === LOWERCASE_TAGS.li) {
          paragraph.children[0].innerHTML = markedText2Html(pre)
          newParagraph.children[0].innerHTML = markedText2Html(post, { start: 0, end: 0 })
        } else {
          paragraph.innerHTML = markedText2Html(pre)
          newParagraph.innerHTML = markedText2Html(post, { start: 0, end: 0 })
        }
        insertAfter(newParagraph, paragraph)
        selection.moveCursor(newParagraph, 0)
        return false
      case left === 0 && right === 0: // paragraph is empty
        if (parTagName === LOWERCASE_TAGS.blockquote) {
          return this.enterInImptyBlockquote(paragraph)
        }
        if (isFirstChildElement(paragraph) && preTagName === LOWERCASE_TAGS.li) {
          tagName = preTagName
          newParagraph = createEmptyElement(this.ids, tagName, attrs)
          insertAfter(newParagraph, paragraph)
        } else if (parTagName === LOWERCASE_TAGS.li) {
          tagName = parTagName
          newParagraph = createEmptyElement(this.ids, tagName, attrs)
          insertAfter(newParagraph, parentNode)
          removeNode(paragraph)
        } else {
          tagName = LOWERCASE_TAGS.p
          newParagraph = createEmptyElement(this.ids, tagName, attrs)
          if (preTagName === LOWERCASE_TAGS.li) {
            // jump out ul
            insertAfter(newParagraph, parentNode)
            removeNode(paragraph)
          } else {
            insertAfter(newParagraph, paragraph)
          }
        }
        selection.moveCursor(newParagraph, 0)
        return false
      case left !== 0 && right === 0: // cursor at end of paragraph
      case left === 0 && right !== 0: // cursor at begin of paragraph
        if (preTagName === LOWERCASE_TAGS.li) tagName = preTagName
        else tagName = LOWERCASE_TAGS.p // insert after or before
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
        tagName = LOWERCASE_TAGS.p
        newParagraph = createEmptyElement(this.ids, tagName, attrs)
        insertAfter(newParagraph, paragraph)
        selection.moveCursor(newParagraph, 0)
        return false
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
    const { start, end } = selectionState
    const preTagName = paragraph.tagName.toLowerCase()
    const markedText = paragraph.textContent
    const chopedText = chopHeader(markedText)
    const chopedLength = markedText.length - chopedText.length
    paragraph.innerHTML = markedText2Html(chopedText)
    let newElement
    if (/^h/.test(inlineUpdate.type)) {
      newElement = updateBlock(paragraph, inlineUpdate.type)
      selection.importSelection(selectionState, newElement)
    } else if (inlineUpdate.type === LOWERCASE_TAGS.blockquote) {
      if (preTagName === LOWERCASE_TAGS.p) {
        newElement = updateBlock(paragraph, inlineUpdate.type)
        nestElementWithTag(this.ids, newElement, LOWERCASE_TAGS.p)
        selection.importSelection({
          start: start - chopedLength,
          end: end - chopedLength
        }, newElement)
      } else {
        // TODO li
        const nestElement = nestElementWithTag(this.ids, paragraph, LOWERCASE_TAGS.p)
        newElement = wrapperElementWithTag(this.ids, nestElement, LOWERCASE_TAGS.blockquote)
      }
    } else if (inlineUpdate.type === LOWERCASE_TAGS.li) {
      switch (inlineUpdate.info) {
        case 'order': // fallthrough
        case 'disorder':
          newElement = updateBlock(paragraph, inlineUpdate.type)
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
          const cursorElement = newElement.querySelector(`#${id}`)
          selection.importSelection({
            start: start - chopedLength,
            end: end - chopedLength
          }, cursorElement)
          break

        case 'tasklist':
          // TODO
          break
      }
    }
  }

  dispatchArrow () {
    const { eventCenter, container } = this
    const changeHandler = event => {
      if (event.key) {
        if (
          event.key === EVENT_KEYS.ArrowLeft ||
          event.key === EVENT_KEYS.ArrowRight ||
          event.key === EVENT_KEYS.ArrowUp ||
          event.key === EVENT_KEYS.ArrowDown
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
      let paragraph = findNearestParagraph(node)
      if (paragraph.tagName.toLowerCase() === LOWERCASE_TAGS.li) {
        paragraph = paragraph.children[0]
      }
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
        this.doc.execCommand('formatBlock', false, LOWERCASE_TAGS.p)
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
    this.emoji.clear() // clear emoji cache for memory recycle
    this.ids.clear()
    this.container = null
    this.activeParagraphId = null
    this.eventCenter = null
    this.ids = null
  }
}

export default Aganippe
