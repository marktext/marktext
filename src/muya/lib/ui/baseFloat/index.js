import Popper from 'popper.js/dist/esm/popper'
import { noop } from '../../utils'
import './index.css'

class BaseFloat {
  constructor () {
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

  hide () {
    if (!this.status) return
    this.status = false
    if (this.popper && this.popper.destroy) {
      this.popper.destroy()
    }
    this.cb = noop
  }

  show (reference, cb = noop) {
    const { container } = this
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
  }
}

export default BaseFloat
