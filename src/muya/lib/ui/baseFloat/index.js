import Popper from 'popper.js/dist/esm/popper'
import { noop } from '../../utils'
import { EVENT_KEYS } from '../../config'
import './index.css'

class BaseFloat {
  constructor (muya, name) {
    this.name = name
    this.muya = muya
    this.status = false
    this.floatBox = null
    this.container = null
    this.popper = null
    this.cb = noop
    this.init()
  }

  init () {
    const floatBox = document.createElement('div')
    const container = document.createElement('div')
    const arrow = document.createElement('div')
    // Use to remember whick float container is shown.
    container.classList.add(this.name)
    container.classList.add(this.muya.theme)
    container.classList.add('ag-float-container')
    floatBox.classList.add('ag-float-wrapper')
    floatBox.classList.add(this.muya.theme)
    arrow.setAttribute('x-arrow', '')
    arrow.classList.add('ag-popper-arrow')
    floatBox.appendChild(arrow)
    floatBox.appendChild(container)
    document.body.appendChild(floatBox)
    const ro = new ResizeObserver(entries => {
      for (const entry of entries) {
        const { offsetWidth, offsetHeight } = entry.target
        Object.assign(floatBox.style, { width: `${offsetWidth + 2}px`, height: `${offsetHeight + 2}px` })
        this.popper && this.popper.update()
      }
    })
    ro.observe(container)
    this.floatBox = floatBox
    this.container = container
  }

  listen () {
    const { eventCenter, container } = this.muya
    const { floatBox } = this
    const keydownHandler = event => {
      if (event.key === EVENT_KEYS.Escape) {
        this.hide()
      }
    }
    const scrollHandler = _ => {
      if (this.status) {
        this.hide()
      }
    }

    eventCenter.attachDOMEvent(document, 'click', this.hide.bind(this))
    eventCenter.attachDOMEvent(floatBox, 'click', event => {
      event.stopPropagation()
      event.preventDefault()
    })
    eventCenter.attachDOMEvent(container, 'keydown', keydownHandler)
    eventCenter.attachDOMEvent(container, 'scroll', scrollHandler)
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
    const { floatBox } = this
    const { eventCenter } = this.muya
    if (this.popper && this.popper.destroy) {
      this.popper.destroy()
    }
    this.cb = cb
    this.popper = new Popper(reference, floatBox, {
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

  destroy () {
    if (this.popper && this.popper.destroy) {
      this.popper.destroy()
    }
    this.floatBox.remove()
  }
}

export default BaseFloat
