import fileIcons from '../fileIcons'
import { CLASS_OR_ID } from '../config'

import './index.css'

const FLOAT_BOX_HEIGHT = 180
const ITEM_HEIGHT = 28

class FloatBox {
  constructor (eventCenter) {
    this.list = []
    this.type = ''
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
      const { cb, list } = this

      if (cb && typeof key === 'number' && !Number.isNaN(key)) {
        this.cb(list[key])
        this.hideIfNeeded([this.type])
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
      // for emoji
      if (l.emoji) {
        const icon = document.createElement('span')
        icon.classList.add(CLASS_OR_ID['AG_FLOAT_ITEM_ICON'])
        icon.setAttribute('key', i)
        icon.textContent = l.emoji
        li.appendChild(icon)
      } else if (l.mode) { // for language
        let className
        if (l.mode.ext && Array.isArray(l.mode.ext)) {
          for (const ext of l.mode.ext) {
            className = fileIcons.getClassWithColor(`fackname.${ext}`)
            if (className) break
          }
        } else if (l.mode.name) {
          className = fileIcons.getClassWithColor(l.mode.name)
        }

        // Because `markdown mode in Codemirror` don't have extensions.
        // if still can not get the className, add a common className 'atom-icon light-cyan'
        if (!className) {
          className = l.text === 'markdown' ? fileIcons.getClassWithColor('fackname.md') : 'atom-icon light-cyan'
        }

        const icon = document.createElement('span')
        icon.classList.add(...className.split(/\s/))
        icon.classList.add(CLASS_OR_ID['AG_FLOAT_ITEM_ICON'])
        icon.setAttribute('key', i)
        li.appendChild(icon)
      } else if (l.iconClass) {
        const { iconClass } = l
        const icon = document.createElement('span')
        icon.innerHTML = `
          <svg class="icon" aria-hidden="true">
            <use xlink:href="#${iconClass}"></use>
          </svg>
        `
        icon.classList.add(CLASS_OR_ID['AG_FLOAT_ITEM_ICON'])
        icon.setAttribute('key', i)
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

  showIfNeeded (position, type, cb) {
    if (cb) this.cb = cb
    if (!this.show || this.type !== type || position.left !== this.position.left || position.top !== this.position.top) {
      let { left, top } = this.position = position
      this.type = type
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

  hideIfNeeded (typeArray) {
    if (!typeArray.includes(this.type)) return
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
