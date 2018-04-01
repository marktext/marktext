import selection from '../selection'
import { CLASS_OR_ID } from '../config'

const imagePathCtrl = ContentState => {
  ContentState.prototype.getImageTextNode = function () {
    const node = selection.getSelectionStart()
    const getNode = node => {
      const parentNode = node && node.parentNode
      if (node && node.classList && node.classList.contains(CLASS_OR_ID['AG_IMAGE_MARKED_TEXT'])) {
        return node
      } else if (parentNode) {
        return getNode(parentNode)
      }
      return null
    }

    return getNode(node)
  }

  ContentState.prototype.showAutoImagePath = function (list) {
    const { floatBox } = this
    const node = this.getImageTextNode()

    if (!node || list.length === 0) {
      return floatBox.hideIfNeeded('image-path')
    }
    const { left, top } = node.getBoundingClientRect()
    const cb = item => {
      const { text } = item
      const { start: { key, offset } } = selection.getCursorRange()
      const block = this.getBlock(key)
      const { text: oldText } = block
      let chop = ''
      block.text = oldText.substring(0, offset).replace(/(\/)([^/]+)$/, (m, p1, p2) => {
        chop = p2
        return p1
      }) + text + oldText.substring(offset)
      this.cursor = {
        start: { key, offset: offset + (text.length - chop.length) },
        end: { key, offset: offset + (text.length - chop.length) }
      }
      floatBox.hideIfNeeded('image-path')
      this.render()
    }
    floatBox.showIfNeeded({ left, top }, 'image-path', cb)
    floatBox.setOptions(list)
  }

  ContentState.prototype.listenForPathChange = function () {
    const { eventCenter, floatBox } = this

    eventCenter.subscribe('image-path', src => {
      const node = this.getImageTextNode()

      if (!node) return
      const { left, top } = node.getBoundingClientRect()

      if (src === '') {
        const cb = item => {
          const type = item.text === 'Absolute Path' ? 'absolute' : (item.text === 'Upload Image' ? 'upload' : 'relative')
          eventCenter.dispatch('insert-image', type)
          floatBox.hideIfNeeded('image')
        }

        const list = [{
          text: 'Absolute Path',
          iconClass: 'icon-folder'
        }, {
          text: 'Relative Path',
          iconClass: 'icon-folder'
        }, {
          text: 'Upload Image',
          iconClass: 'icon-upload'
        }]

        floatBox.showIfNeeded({ left, top }, 'image', cb)
        floatBox.setOptions(list)
      } else if (src && typeof src === 'string' && src.length) {
        eventCenter.dispatch('image-path-autocomplement', src)
      }
    })
  }
}

export default imagePathCtrl
