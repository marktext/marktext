import { getLinkInfo } from '../utils/getLinkInfo'

class MouseEvent {
  constructor (muya) {
    this.muya = muya
    this.mouseBinding()
    this.mouseDown()
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

  mouseDown () {
    const { container, eventCenter, contentState } = this.muya
    const handler = event => {
      const target = event.target
      if (target.classList && target.classList.contains('ag-drag-handler')) {
        contentState.handleMouseDown(event)
      } else if (target && target.closest('tr')) {
        contentState.handleCellMouseDown(event)
      }
    }
    eventCenter.attachDOMEvent(container, 'mousedown', handler)
  }
}

export default MouseEvent
