import { getLinkInfo } from '../utils/getLinkInfo'

class MouseEvent {
  constructor (muya) {
    this.muya = muya
    this.mouseBinding()
  }

  mouseBinding () {
    const { container, eventCenter } = this.muya
    const handler = event => {
      const target = event.target
      const parent = target.parentNode
      if (parent && parent.tagName === 'A' && parent.classList.contains('ag-inline-rule')) {
        const rect = parent.getBoundingClientRect()
        const reference = {
          getBoundingClientRect () {
            return rect
          }
        }

        eventCenter.dispatch('muya-link-tools', {
          reference,
          linkInfo: getLinkInfo(parent)
        })
      }
    }
    const leaveHandler = event => {
      const target = event.target
      const parent = target.parentNode

      if (parent && parent.tagName === 'A' && parent.classList.contains('ag-inline-rule')) {
        eventCenter.dispatch('muya-link-tools', {
          reference: null
        })
      }
    }

    eventCenter.attachDOMEvent(container, 'mouseover', handler)
    eventCenter.attachDOMEvent(container, 'mouseout', leaveHandler)
  }
}

export default MouseEvent
