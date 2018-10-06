import Popper from 'popper.js/dist/esm/popper'
import { noop } from '../../utils'
import './index.css'

class BaseFloat {
  constructor (muya, name) {
    this.name = name
    this.muya = muya
    this.status = false
    this.container = null
    this.popper = null
    this.cb = noop
    this.init()
  }

  init () {
    const floatBox = document.createElement('div')
    floatBox.classList.add('ag-float-container')
    document.body.appendChild(floatBox)
    this.container = floatBox
  }

  listen () {
    const { eventCenter } = this.muya
    const { container } = this
    eventCenter.attachDOMEvent(document, 'click', this.hide.bind(this))
    eventCenter.attachDOMEvent(container, 'click', event => {
      event.stopPropagation()
      event.preventDefault()
    })
  }

  hide () {
    const { eventCenter } = this.muya
    if (!this.status) return
    this.status = false
    if (this.popper && this.popper.destroy) {
      this.popper.destroy()
    }
    this.cb = noop
    eventCenter.dispatch('muya-float', this.name, false)
  }

  show (reference, cb = noop) {
    const { container } = this
    const { eventCenter } = this.muya
    if (this.popper && this.popper.destroy) {
      this.popper.destroy()
    }
    this.cb = cb
    this.popper = new Popper(reference, container, {
      placement: 'bottom-start',
      modifiers: {
        offset: {
          offset: '-20, 12'
        }
      }
    })
    this.status = true
    eventCenter.dispatch('muya-float', this.name, true)
  }
}

export default BaseFloat
