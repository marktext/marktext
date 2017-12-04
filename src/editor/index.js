import ContentState from './contentState'
import Event from './event'
import { LOWERCASE_TAGS, EVENT_KEYS } from './config'

class Aganippe {
  constructor (container, options) {
    this.container = container
    this.eventCenter = new Event()
    this.contentState = new ContentState()
    this.init()
  }

  init () {
    this.ensureContainerDiv()
    const { container, contentState } = this
    contentState.stateRender.setContainer(container.children[0])
    contentState.render()

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
}

export default Aganippe
