import selection from '../selection'
import { tokenizer, generator } from '../parser/'
import { FORMAT_MARKER_MAP, FORMAT_TYPES } from '../config'
import { getImageInfo } from '../utils/getImageInfo'

const getOffset = (offset, { range: { start, end }, type, tag, anchor, alt }) => {
  const dis = offset - start
  const len = end - start
  switch (type) {
    case 'strong':
    case 'del':
    case 'em':
    case 'inline_code':
    case 'inline_math': {
      const MARKER_LEN = (type === 'strong' || type === 'del') ? 2 : 1
      if (dis < 0) return 0
      if (dis >= 0 && dis < MARKER_LEN) return -dis
      if (dis >= MARKER_LEN && dis <= len - MARKER_LEN) return -MARKER_LEN
      if (dis > len - MARKER_LEN && dis <= len) return len - dis - 2 * MARKER_LEN
      if (dis > len) return -2 * MARKER_LEN
      break
    }
    case 'html_tag': { // handle underline, sup, sub
      const OPEN_MARKER_LEN = FORMAT_MARKER_MAP[tag].open.length
      const CLOSE_MARKER_LEN = FORMAT_MARKER_MAP[tag].close.length
      if (dis < 0) return 0
      if (dis >= 0 && dis < OPEN_MARKER_LEN) return -dis
      if (dis >= OPEN_MARKER_LEN && dis <= len - CLOSE_MARKER_LEN) return -OPEN_MARKER_LEN
      if (dis > len - CLOSE_MARKER_LEN && dis <= len) return len - dis - OPEN_MARKER_LEN - CLOSE_MARKER_LEN
      if (dis > len) return -OPEN_MARKER_LEN - CLOSE_MARKER_LEN
      break
    }
    case 'link': {
      const MARKER_LEN = 1
      if (dis < MARKER_LEN) return 0
      if (dis >= MARKER_LEN && dis <= MARKER_LEN + anchor.length) return -1
      if (dis > MARKER_LEN + anchor.length) return anchor.length - dis
      break
    }
    case 'image': {
      const MARKER_LEN = 1
      if (dis < MARKER_LEN) return 0
      if (dis >= MARKER_LEN && dis < MARKER_LEN * 2) return -1
      if (dis >= MARKER_LEN * 2 && dis <= MARKER_LEN * 2 + alt.length) return -2
      if (dis > MARKER_LEN * 2 + alt.length) return alt.length - dis
      break
    }
  }
}

const clearFormat = (token, { start, end }) => {
  if (start) {
    const deltaStart = getOffset(start.offset, token)
    start.delata += deltaStart
  }
  if (end) {
    const delataEnd = getOffset(end.offset, token)
    end.delata += delataEnd
  }
  switch (token.type) {
    case 'strong':
    case 'del':
    case 'em':
    case 'link':
    case 'html_tag': { // underline, sub, sup
      const { parent } = token
      const index = parent.indexOf(token)
      parent.splice(index, 1, ...token.children)
      break
    }
    case 'image': {
      token.type = 'text'
      token.raw = token.alt
      delete token.marker
      delete token.src
      break
    }
    case 'inline_math':
    case 'inline_code': {
      token.type = 'text'
      token.raw = token.content
      delete token.marker
      break
    }
  }
}

const addFormat = (type, block, { start, end }) => {
  if (block.type === 'pre') return false
  switch (type) {
    case 'em':
    case 'del':
    case 'inline_code':
    case 'strong':
    case 'inline_math': {
      const MARKER = FORMAT_MARKER_MAP[type]
      const oldText = block.text
      block.text = oldText.substring(0, start.offset) +
        MARKER + oldText.substring(start.offset, end.offset) +
        MARKER + oldText.substring(end.offset)
      start.offset += MARKER.length
      end.offset += MARKER.length
      break
    }
    case 'sub':
    case 'sup':
    case 'u': {
      const MARKER = FORMAT_MARKER_MAP[type]
      const oldText = block.text
      block.text = oldText.substring(0, start.offset) +
        MARKER.open + oldText.substring(start.offset, end.offset) +
        MARKER.close + oldText.substring(end.offset)
      start.offset += MARKER.open.length
      end.offset += MARKER.open.length
      break
    }
    case 'link':
    case 'image': {
      const oldText = block.text
      const anchorTextLen = end.offset - start.offset
      block.text = oldText.substring(0, start.offset) +
        (type === 'link' ? '[' : '![') +
        oldText.substring(start.offset, end.offset) + ']()' +
        oldText.substring(end.offset)
      // put cursor between `()`
      start.offset += type === 'link' ? 3 + anchorTextLen : 4 + anchorTextLen
      end.offset = start.offset
      break
    }
  }
}

const checkTokenIsInlineFormat = token => {
  const { type, tag } = token
  if (FORMAT_TYPES.includes(type)) return true
  if (type === 'html_tag' && /^(?:u|sub|sup)$/i.test(tag)) return true
  return false
}

const formatCtrl = ContentState => {
  ContentState.prototype.selectionFormats = function ({ start, end } = selection.getCursorRange()) {
    if (!start || !end) {
      return { formats: [], tokens: [], neighbors: [] }
    }
    const startBlock = this.getBlock(start.key)
    const formats = []
    const neighbors = []
    let tokens = []
    if (start.key === end.key) {
      const { text } = startBlock
      tokens = tokenizer(text)
      ;(function iterator (tks) {
        for (const token of tks) {
          if (
            checkTokenIsInlineFormat(token) &&
            start.offset >= token.range.start &&
            end.offset <= token.range.end
          ) {
            formats.push(token)
          }
          if (
            checkTokenIsInlineFormat(token) &&
            ((start.offset >= token.range.start && start.offset <= token.range.end) ||
            (end.offset >= token.range.start && end.offset <= token.range.end) ||
            (start.offset <= token.range.start && token.range.end <= end.offset))
          ) {
            neighbors.push(token)
          }
          if (token.children && token.children.length) {
            iterator(token.children)
          }
        }
      })(tokens)
    }

    return { formats, tokens, neighbors }
  }

  ContentState.prototype.clearBlockFormat = function (block, { start, end } = selection.getCursorRange(), type) {
    if (!start || !end) {
      return
    }
    if (block.type === 'pre') return false
    const { key } = block
    let tokens
    let neighbors
    if (start.key === end.key && start.key === key) {
      ({ tokens, neighbors } = this.selectionFormats({ start, end }))
    } else if (start.key !== end.key && start.key === key) {
      ({ tokens, neighbors } = this.selectionFormats({ start, end: { key: start.key, offset: block.text.length } }))
    } else if (start.key !== end.key && end.key === key) {
      ({ tokens, neighbors } = this.selectionFormats({
        start: {
          key: end.key,
          offset: 0
        },
        end
      }))
    } else {
      ({ tokens, neighbors } = this.selectionFormats({
        start: {
          key,
          offset: 0
        },
        end: {
          key,
          offset: block.text.length
        }
      }))
    }

    neighbors = type ? neighbors.filter(n => {
      return n.type === type ||
      n.type === 'html_tag' && n.tag === type
    }) : neighbors

    for (const neighbor of neighbors) {
      clearFormat(neighbor, { start, end })
    }
    start.offset += start.delata
    end.offset += end.delata
    block.text = generator(tokens)
  }

  ContentState.prototype.format = function (type) {
    const { start, end } = selection.getCursorRange()
    if (!start || !end) {
      return
    }
    const startBlock = this.getBlock(start.key)
    const endBlock = this.getBlock(end.key)
    start.delata = end.delata = 0
    if (start.key === end.key) {
      const { formats, tokens, neighbors } = this.selectionFormats()
      const currentFormats = formats.filter(format => {
        return format.type === type ||
          format.type === 'html_tag' && format.tag === type
      }).reverse()
      const currentNeightbors = neighbors.filter(format => {
        return format.type === type ||
        format.type === 'html_tag' && format.tag === type
      }).reverse()
      // cache delata
      if (type === 'clear') {
        for (const neighbor of neighbors) {
          clearFormat(neighbor, { start, end })
        }
        start.offset += start.delata
        end.offset += end.delata
        startBlock.text = generator(tokens)
      } else if (currentFormats.length) {
        for (const token of currentFormats) {
          clearFormat(token, { start, end })
        }
        start.offset += start.delata
        end.offset += end.delata
        startBlock.text = generator(tokens)
      } else {
        if (currentNeightbors.length) {
          for (const neighbor of currentNeightbors) {
            clearFormat(neighbor, { start, end })
          }
        }
        start.offset += start.delata
        end.offset += end.delata
        startBlock.text = generator(tokens)
        addFormat(type, startBlock, { start, end })
        if (type === 'image') {
          // Show image selector when create a inline image by menu/shortcut/or just input `![]()`
          requestAnimationFrame(() => {
            const startNode = selection.getSelectionStart()
            if (startNode) {
              const imageWrapper = startNode.closest('.ag-inline-image')
              if (imageWrapper && imageWrapper.classList.contains('ag-empty-image')) {
                const imageInfo = getImageInfo(imageWrapper)
                this.muya.eventCenter.dispatch('muya-image-selector', {
                  reference: imageWrapper,
                  imageInfo,
                  cb: () => {}
                })
              }
            }
          })
        }
      }
      this.cursor = { start, end }
      this.partialRender()
    } else {
      let nextBlock = startBlock
      const formatType = type !== 'clear' ? type : undefined
      while (nextBlock && nextBlock !== endBlock) {
        this.clearBlockFormat(nextBlock, { start, end }, formatType)
        nextBlock = this.findNextBlockInLocation(nextBlock)
      }
      this.clearBlockFormat(endBlock, { start, end }, formatType)

      if (type !== 'clear') {
        addFormat(type, startBlock, {
          start,
          end: { offset: startBlock.text.length }
        })
        nextBlock = this.findNextBlockInLocation(startBlock)
        while (nextBlock && nextBlock !== endBlock) {
          addFormat(type, nextBlock, {
            start: { offset: 0 },
            end: { offset: nextBlock.text.length }
          })
          nextBlock = this.findNextBlockInLocation(nextBlock)
        }
        addFormat(type, endBlock, {
          start: { offset: 0 },
          end
        })
      }

      this.cursor = { start, end }
      this.partialRender()
    }
  }
}

export default formatCtrl
