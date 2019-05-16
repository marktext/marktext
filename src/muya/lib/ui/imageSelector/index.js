import BaseFloat from '../baseFloat'
import { patch, h } from '../../parser/render/snabbdom'

import './index.css'

class ImageSelector extends BaseFloat {
  static pluginName = 'imageSelector'
  constructor (muya) {
    const name = 'ag-image-selector'
    const options = {
      placement: 'bottom-center',
      modifiers: {
        offset: {
          offset: '0, 0'
        }
      },
      showArrow: false
    }
    super(muya, name, options)
    this.renderArray = []
    this.oldVnode = null
    this.imageInfo = null
    this.tab = 'link' // select or link
    this.isFullMode = false // is show title and alt input
    this.state = {
      alt: '',
      src: '',
      title: ''
    }
    const imageSelectorContainer = this.imageSelectorContainer = document.createElement('div')
    this.container.appendChild(imageSelectorContainer)
    this.floatBox.classList.add('ag-image-selector-wrapper')
    this.listen()
  }
  listen () {
    super.listen()
    const { eventCenter } = this.muya
    eventCenter.subscribe('muya-image-selector', ({ reference, cb, imageInfo }) => {
      if (reference) {
        let { alt, backlash, src, title } = imageInfo.token
        alt += encodeURI(backlash.first)
        Object.assign(this.state, { alt, title, src })
        this.imageInfo = imageInfo
        this.show(reference, cb)
        this.render()
      } else {
        this.hide()
      }
    })
  }

  tabClick (event, tab) {
    const { value } = tab
    this.tab = value
    return this.render()
  }

  toggleMode () {
    this.isFullMode = !this.isFullMode
    return this.render()
  }

  inputHandler (event, type) {
    const value = event.target.value
    this.state[type] = value
  }

  handleLinkButtonClick () {
    this.muya.contentState.replaceImage(this.imageInfo, this.state)
    return this.hide()
  }

  renderHeader () {
    const tabs = [{
      label: 'Select',
      value: 'select'
    }, {
      label: 'Embed link',
      value: 'link'
    }]
    const children = tabs.map(tab => {
      const itemSelector = this.tab === tab.value ? 'li.active' : 'li'
      return h(itemSelector, h('span', {
        on: {
          click: event => {
            this.tabClick(event, tab)
          }
        }
      }, tab.label))
    })

    return h('ul.header', children)
  }

  renderBody () {
    const { tab, state, isFullMode } = this
    const { alt, title, src } = state
    let bodyContent = null
    if (tab === 'select') {
      bodyContent = [
        h('span.role-button.select', 'Choose an Image'),
        h('span.description', 'Choose image from you computer.')
      ]
    } else {
      const altInput = h('input.alt', {
        props: {
          placeholder: 'Alt text',
          value: alt
        },
        on: {
          change: event => {
            this.inputHandler(event, 'alt')
          }
        }
      })
      const srcInput = h('input.src', {
        props: {
          placeholder: 'Image link or local path',
          value: src
        },
        on: {
          change: event => {
            this.inputHandler(event, 'src')
          }
        }
      })
      const titleInput = h('input.title', {
        props: {
          placeholder: 'Image title',
          value: title
        },
        on: {
          change: event => {
            this.inputHandler(event, 'title')
          }
        }
      })

      const inputWrapper = isFullMode
        ? h('div.input-container', [altInput, srcInput, titleInput])
        : h('div.input-container', [srcInput])
      
      const embedButton = h('span.role-button.link', {
        on: {
          click: event => {
            this.handleLinkButtonClick()
          }
        }
      }, 'Embed Image')
      const bottomDes = h('span.description', [
        h('span', 'Paste web image or local image path, '),
        h('a', {
          on: {
            click: event => {
              this.toggleMode()
            }
          }
        }, `${isFullMode ? 'simple mode' : 'full mode'}`)
      ])
      bodyContent = [inputWrapper, embedButton, bottomDes]
    }

    return h('div.image-select-body', bodyContent)
  }

  render () {
    const { oldVnode, imageSelectorContainer } = this
    const selector = 'div'
    const vnode = h(selector, [this.renderHeader(), this.renderBody()])
    if (oldVnode) {
      patch(oldVnode, vnode)
    } else {
      patch(imageSelectorContainer, vnode)
    }
    this.oldVnode = vnode
  }
}

export default ImageSelector
