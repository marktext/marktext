import { FLOAT_BOX_ID, FLOAT_BOX_CLASSNAME, SHOW_EMOJI_BOX, EMOJI_ITEM, EMOJI_ICON, EMOJI_ITEM_ACTIVE } from '../config'

class FloatBox {
  constructor (event) {
    this.event = event
    console.log(event)
    this.box = null
    this.cb = null
    this.initBox()
  }

  initBox () {
    let box = document.querySelector(`#${FLOAT_BOX_ID}`)
    const clickHandler = event => {
      const target = event.target
      const key = target.getAttribute('key')
      if (this.cb && key !== undefined) {
        this.cb(key)
      }
    }

    if (!box) {
      box = document.createElement('ul')
      box.id = FLOAT_BOX_ID
      box.classList.add(FLOAT_BOX_CLASSNAME)
      document.body.appendChild(box)
      this.event.attachDOMEvent(box, 'click', clickHandler)
    }
    this.box = box
  }

  setOptions (list, index, position, cb) {
    if (cb) this.cb = cb
    if (position) {
      const { left, top } = position
      Object.assign(this.box.style, { left, top })
    }
    const fragment = document.createDocumentFragment()
    list.forEach((l, i) => {
      const li = document.createElement('li')
      const span = document.createElement('span')
      const textSpan = document.createElement('span')
      span.classList.add(EMOJI_ICON)
      li.classList.add(EMOJI_ITEM)
      ;[span, textSpan, li].forEach(ele => {
        ele.setAttribute('key', i)
      })
      if (i === index) li.classList.add(EMOJI_ITEM_ACTIVE)
      span.textContent = l.emoji
      textSpan.textContent = l.aliases[0]
      li.appendChild(span)
      li.appendChild(textSpan)

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
    return box.classList.contains(SHOW_EMOJI_BOX)
  }

  showIfNeeded () {
    if (!this.checkStatus()) {
      this.box.classList.add(SHOW_EMOJI_BOX)
    }
  }

  hideIfNeeded () {
    this.empty()
    this.cb = null
    if (this.checkStatus()) {
      this.box.classList.remove(SHOW_EMOJI_BOX)
    }
  }
}

export default FloatBox
