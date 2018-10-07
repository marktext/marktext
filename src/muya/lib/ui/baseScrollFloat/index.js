import BaseFloat from '../baseFloat'
import { EVENT_KEYS } from '../../config'

class BaseScrollFloat extends BaseFloat {
  constructor (muya, name) {
    super(muya, name)
    this.scrollElement = null
    this.reference = null
    this.activeItem = null
    this.createScrollElement()
  }

  createScrollElement () {
    const { container } = this
    const scrollElement = document.createElement('div')
    container.appendChild(scrollElement)
    this.scrollElement = scrollElement
  }

  activeEleScrollIntoView (ele) {
    if (ele) {
      ele.scrollIntoView({
        behavior: 'auto'
      })
    }
  }

  listen () {
    super.listen()
    const { eventCenter, container } = this.muya
    const handler = event => {
      if (!this.status) return
      switch (event.key) {
        case EVENT_KEYS.ArrowUp:
          this.step('previous')
          break
        case EVENT_KEYS.ArrowDown:
        case EVENT_KEYS.Tab:
          this.step('next')
          break
        case EVENT_KEYS.Enter:
          this.selectItem(this.activeItem)
          break
        default:
          break
      }
    }

    eventCenter.attachDOMEvent(container, 'keydown', handler)
  }

  hide () {
    super.hide()
    this.reference = null
  }

  show (reference, cb) {
    if (reference instanceof HTMLElement) {
      if (this.reference && this.reference === reference && this.status) return
    } else {
      if (this.reference && this.reference.id === reference.id && this.status) return
    }

    this.reference = reference
    super.show(reference, cb)
  }

  step () {}

  selectItem () {}

  getItemElement () {}
}

export default BaseScrollFloat
