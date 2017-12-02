import ContentState from './contentState'
import Event from './event'
import { LOWERCASE_TAGS } from './config'

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
    contentState.stateRender.setContainer(container.firstChild)
    contentState.render()
    this.dispatchUpdateState()
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
