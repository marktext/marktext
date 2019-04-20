import selection from '../selection'
import { findNearestParagraph } from '../selection/dom'
import { CLASS_OR_ID } from '../config'
import { getParagraphReference } from '../utils'

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
    const { eventCenter } = this.muya
    const node = this.getImageTextNode()

    if (!node) {
      return eventCenter.dispatch('muya-image-picker', { list: [] })
    }

    const cb = item => {
      const { text } = item
      const { start: { key, offset } } = this.cursor
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
      this.partialRender()
    }
    const paragraph = findNearestParagraph(node)
    const reference = getParagraphReference(node, paragraph.id)

    eventCenter.dispatch('muya-image-picker', { reference, list, cb })
  }

  ContentState.prototype.listenForPathChange = function () {
    const { eventCenter } = this.muya

    eventCenter.subscribe('image-path', src => {
      const node = this.getImageTextNode()

      if (!node) {
        return eventCenter.dispatch('muya-image-picker', { list: [] })
      }
      if (src === '') {
        const cb = item => {
          const type = item.label
          eventCenter.dispatch('insert-image', type)
        }

        const list = [{
          text: 'Absolute Path',
          iconClass: 'icon-folder',
          label: 'absolute'
        }, {
          text: 'Relative Path',
          iconClass: 'icon-folder',
          label: 'relative'
        }, {
          text: 'Upload Image',
          iconClass: 'icon-upload',
          label: 'upload'
        }]

        const paragraph = findNearestParagraph(node)
        const reference = getParagraphReference(node, paragraph.id)
        eventCenter.dispatch('muya-image-picker', {
          reference,
          list,
          cb
        })
      } else if (src && typeof src === 'string' && src.length) {
        eventCenter.dispatch('muya-image-picker', {
          list: []
        })
        eventCenter.dispatch('image-path-autocomplement', src)
      }
    })
  }
}

export default imagePathCtrl
