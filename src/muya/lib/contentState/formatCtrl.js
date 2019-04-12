import selection from '../selection'
import { tokenizer, generator } from '../parser/'
import { FORMAT_MARKER_MAP, FORMAT_TYPES, URL_REG } from '../config'

const getOffset = (offset, { range: { start, end }, type, anchor, alt }) => {
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
    case 'link': {
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
    case 'link':
    case 'image': {
      const oldText = block.text
      block.text = oldText.substring(0, start.offset) +
        (type === 'link' ? '[' : '![') +
        oldText.substring(start.offset, end.offset) + ']()' +
        oldText.substring(end.offset)
      start.offset += type === 'link' ? 1 : 2
      end.offset += type === 'link' ? 1 : 2
      break
    }
  }
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
            FORMAT_TYPES.includes(token.type) &&
            start.offset >= token.range.start &&
            end.offset <= token.range.end
          ) {
            formats.push(token)
          }
          if (
            FORMAT_TYPES.includes(token.type) &&
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

    neighbors = type ? neighbors.filter(n => n.type === type) : neighbors

    for (const neighbor of neighbors) {
      clearFormat(neighbor, { start, end })
    }
    start.offset += start.delata
    end.offset += end.delata
    block.text = generator(tokens)
  }

  ContentState.prototype.insertImage = function (url) {
    const title = /\/?([^./]+)\.[a-z]+$/.exec(url)[1] || ''
    const { start, end } = this.cursor
    const { formats } = this.selectionFormats({ start, end })
    const { key, offset: startOffset } = start
    const { offset: endOffset } = end
    const block = this.getBlock(key)
    const { text } = block
    const imageFormat = formats.filter(f => f.type === 'image')

    // Only encode URLs but not local paths or data URLs
    let imgUrl
    if (URL_REG.test(url)) {
      imgUrl = encodeURI(url)
    } else {
      imgUrl = url
    }

    if (imageFormat.length === 1) {
      // Replace already existing image
      let imageTitle = title

      // Extract title from image if there isn't an image source already (GH#562). E.g: ![old-title]()
      if (imageFormat[0].alt && !imageFormat[0].src) {
        imageTitle = imageFormat[0].alt
      }

      const { start, end } = imageFormat[0].range
      block.text = text.substring(0, start) +
        `![${imageTitle}](${imgUrl})` +
        text.substring(end)

      this.cursor = {
        start: { key, offset: start + 2 },
        end: { key, offset: start + 2 + imageTitle.length }
      }
    } else if (key !== end.key) {
      // Replace multi-line text
      const endBlock = this.getBlock(end.key)
      const { text } = endBlock
      endBlock.text = text.substring(0, endOffset) + `![${title}](${imgUrl})` + text.substring(endOffset)
      const offset = endOffset + 2
      this.cursor = {
        start: { key: end.key, offset },
        end: { key: end.key, offset: offset + title.length }
      }
    } else {
      // Replace single-line text
      const imageTitle = startOffset !== endOffset ? text.substring(startOffset, endOffset) : title
      block.text = text.substring(0, start.offset) +
        `![${imageTitle}](${imgUrl})` +
        text.substring(end.offset)

      this.cursor = {
        start: {
          key,
          offset: startOffset + 2
        },
        end: {
          key,
          offset: startOffset + 2 + imageTitle.length
        }
      }
    }
    this.partialRender()
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
      const currentFormats = formats.filter(format => format.type === type).reverse()
      const currentNeightbors = neighbors.filter(format => format.type === type).reverse()
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
