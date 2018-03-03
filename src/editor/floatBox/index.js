import {
  CLASS_OR_ID
} from '../config'

import './index.css'

const FLOAT_BOX_HEIGHT = 180
const ITEM_HEIGHT = 28

class FloatBox {
  constructor (eventCenter) {
    this.list = []
    this.index = 0
    this.position = null
    this.eventCenter = eventCenter
    this.show = false
    this.box = null
    this.cb = null
    this.initBox()
  }

  initBox () {
    let box = document.querySelector(`#${CLASS_OR_ID['AG_FLOAT_BOX_ID']}`)
    const clickHandler = event => {
      const target = event.target
      const key = +target.getAttribute('key')
      if (this.cb && key !== undefined) {
        this.cb(this.list[key])
      }
    }

    if (!box) {
      box = document.createElement('ul')
      box.id = CLASS_OR_ID['AG_FLOAT_BOX_ID']
      box.classList.add(CLASS_OR_ID['AG_FLOAT_BOX'])
      document.body.appendChild(box)
      this.eventCenter.attachDOMEvent(box, 'click', clickHandler)
    }
    this.box = box
  }

  setOptions (list, index) {
    const fragment = document.createDocumentFragment()
    this.list = list
    if (index !== undefined) {
      this.index = index
    }

    list.forEach((l, i) => {
      const li = document.createElement('li')
      li.classList.add(CLASS_OR_ID['AG_FLOAT_ITEM'])
      if (i === this.index) li.classList.add(CLASS_OR_ID['AG_FLOAT_ITEM_ACTIVE'])
      if (l.emoji) {
        const icon = document.createElement('span')
        icon.classList.add(CLASS_OR_ID['AG_FLOAT_ITEM_ICON'])
        icon.setAttribute('key', i)
        icon.textContent = l.emoji
        li.appendChild(icon)
      }
      const text = document.createElement('span')

      ;[text, li].forEach(ele => {
        ele.setAttribute('key', i)
      })

      text.textContent = l.text
      li.appendChild(text)

      fragment.appendChild(li)
    })
    this.empty()
    this.box.appendChild(fragment)
    this.box.scrollTop = ITEM_HEIGHT * this.index
  }

  empty () {
    Array.from(this.box.childNodes).forEach(c => this.box.removeChild(c))
  }

  showIfNeeded (position, cb) {
    if (cb) this.cb = cb
    if (!this.show) {
      let { left, top } = position
      this.position = { left, top }
      const viewHeight = document.documentElement.offsetHeight
      if (viewHeight - top <= FLOAT_BOX_HEIGHT + 25) {
        top = top - (FLOAT_BOX_HEIGHT + 5) // left 5px between floatbox and input element
      } else {
        top = top + 25
      }
      Object.assign(this.box.style, { left: `${left}px`, top: `${top}px` })

      this.box.classList.add(CLASS_OR_ID['AG_SHOW_FLOAT_BOX'])
    }
    this.show = true
  }

  hideIfNeeded () {
    this.empty()
    this.cb = null
    this.list = []
    this.index = 0
    if (this.show) {
      this.box.classList.remove(CLASS_OR_ID['AG_SHOW_FLOAT_BOX'])
      this.box.removeAttribute('style')
    }
    this.show = false
  }

  destroy () {
    this.box.parentNode.removeChild(this.box)
  }
}

export default FloatBox
