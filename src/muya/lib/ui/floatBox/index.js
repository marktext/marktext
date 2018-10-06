import Popper from 'popper.js/dist/esm/popper'
import fileIcons from '../fileIcons'
import { CLASS_OR_ID } from '../../config'

import './index.css'

const ITEM_HEIGHT = 28

class FloatBox {
  constructor (muya) {
    this.list = []
    this.index = 0
    this.position = null
    this.muya = muya
    this.show = false
    this.box = null
    this.cb = null
    this.eventId = null
    this.popper = null
    this.initBox()
  }

  clickHandler (event) {
    const target = event.target
    const key = +target.getAttribute('key')
    const { cb, list } = this

    if (cb && typeof key === 'number' && !Number.isNaN(key)) {
      this.cb(list[key])
      this.hideIfNeeded()
    }
  }

  initBox () {
    let box = document.querySelector(`#${CLASS_OR_ID['AG_FLOAT_BOX_ID']}`)

    if (!box) {
      box = document.createElement('ul')
      box.id = CLASS_OR_ID['AG_FLOAT_BOX_ID']
      box.classList.add(CLASS_OR_ID['AG_FLOAT_BOX'])
      document.body.appendChild(box)
      this.eventId = this.muya.eventCenter.attachDOMEvent(box, 'click', this.clickHandler.bind(this))
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
    Array.from(this.box.childNodes).forEach(c => c.remove())
  }

  showIfNeeded (element, cb) {
    const rect = element.getBoundingClientRect()
    const { top, left } = rect
    const reference = {
      getBoundingClientRect () {
        return rect
      },
      clientWidth: element.clientWidth,
      clientHeight: element.clientHeight
    }

    if (cb) this.cb = cb
    if (!this.show || this.position.left !== left || this.position.top !== top) {
      this.position = { top, left }
      if (this.popper && this.popper.destroy) {
        this.popper.destroy()
      }
      this.popper = new Popper(reference, this.box, {
        placement: 'bottom-start',
        modifiers: {
          offset: {
            offset: '-20, 12'
          }
        }
      })
    }
    this.show = true
  }

  hideIfNeeded () {
    this.empty()
    this.cb = null
    this.list = []
    this.index = 0
    if (this.popper && this.popper.destroy) {
      this.popper.destroy()
    }
    this.show = false
    this.popper = null
  }

  destroy () {
    this.muya.eventCenter.detachDOMEvent(this.eventId)
    this.box.remove()
  }
}

export default FloatBox
