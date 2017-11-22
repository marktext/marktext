import {
  CLASS_OR_ID
} from '../config'

class FloatBox {
  constructor (event) {
    this.event = event
    this.box = null
    this.cb = null
    this.initBox()
  }

  initBox () {
    let box = document.querySelector(`#${CLASS_OR_ID['AG_FLOAT_BOX_ID']}`)
    const clickHandler = event => {
      const target = event.target
      const key = target.getAttribute('key')
      if (this.cb && key !== undefined) {
        this.cb(key)
      }
    }

    if (!box) {
      box = document.createElement('ul')
      box.id = CLASS_OR_ID['AG_FLOAT_BOX_ID']
      box.classList.add(CLASS_OR_ID['AG_FLOAT_BOX'])
      document.body.appendChild(box)
      this.event.attachDOMEvent(box, 'click', clickHandler)
    }
    this.box = box
  }

  setOptions (list, index) {
    const fragment = document.createDocumentFragment()
    list.forEach((l, i) => {
      const li = document.createElement('li')
      li.classList.add(CLASS_OR_ID['AG_FLOAT_ITEM'])
      if (i === index) li.classList.add(CLASS_OR_ID['AG_FLOAT_ITEM_ACTIVE'])
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
  }

  empty () {
    Array.from(this.box.childNodes).forEach(c => this.box.removeChild(c))
  }

  checkStatus () {
    const { box } = this
    return box.classList.contains(CLASS_OR_ID['AG_SHOW_FLOAT_BOX'])
  }

  showIfNeeded (position, cb) {
    if (cb) this.cb = cb
    if (!this.checkStatus()) {
      if (position) {
        const { left, top } = position
        Object.assign(this.box.style, { left, top })
      }
      this.box.classList.add(CLASS_OR_ID['AG_SHOW_FLOAT_BOX'])
    }
  }

  hideIfNeeded () {
    this.empty()
    this.cb = null
    if (this.checkStatus()) {
      this.box.classList.remove(CLASS_OR_ID['AG_SHOW_FLOAT_BOX'])
    }
  }
}

export default FloatBox
