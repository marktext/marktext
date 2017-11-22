import {
  CLASS_OR_ID
} from '../config'

class FloatBox {
  constructor (event) {
    this.list = []
    this.index = 0
    this.event = event
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
        console.log(this.list[key])
        this.cb(this.list[key])
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
    const ITEM_HEIGHT = 33
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
      const { left, top } = position
      Object.assign(this.box.style, { left, top })

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
    }
    this.show = false
  }
}

export default FloatBox
