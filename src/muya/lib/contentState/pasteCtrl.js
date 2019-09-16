
import { PARAGRAPH_TYPES, PREVIEW_DOMPURIFY_CONFIG, HAS_TEXT_BLOCK_REG, IMAGE_EXT_REG } from '../config'
import { sanitize, getUniqueId, getImageInfo as getImageSrc, getPageTitle } from '../utils'
import { getImageInfo } from '../utils/getImageInfo'

const LIST_REG = /ul|ol/
const LINE_BREAKS_REG = /\n/

const pasteCtrl = ContentState => {
  // check paste type: `MERGE` or `NEWLINE`
  ContentState.prototype.checkPasteType = function (start, fragment) {
    const fragmentType = fragment.type
    const parent = this.getParent(start)

    if (fragmentType === 'p') {
      return 'MERGE'
    } else if (/^h\d/.test(fragmentType)) {
      if (start.text) {
        return 'MERGE'
      } else {
        return 'NEWLINE'
      }
    } else if (LIST_REG.test(fragmentType)) {
      const listItem = this.getParent(parent)
      const list = listItem && listItem.type === 'li' ? this.getParent(listItem) : null
      if (list) {
        if (
          list.listType === fragment.listType &&
          listItem.bulletMarkerOrDelimiter === fragment.children[0].bulletMarkerOrDelimiter
        ) {
          return 'MERGE'
        } else {
          return 'NEWLINE'
        }
      } else {
        return 'NEWLINE'
      }
    } else {
      return 'NEWLINE'
    }
  }

  ContentState.prototype.checkCopyType = function (html, text) {
    let type = 'normal'
    if (!html && text) {
      type = 'copyAsMarkdown'
      const match = /^<([a-zA-Z\d-]+)(?=\s|>).*?>[\s\S]+?<\/[a-zA-Z\d-]+>$/.exec(text.trim())
      if (match && match[1]) {
        const tag = match[1]
        type = PARAGRAPH_TYPES.find(type => type === tag) ? 'copyAsHtml' : type
      }
    }
    return type
  }

  ContentState.prototype.standardizeHTML = async function (html) {
    // Only extract the `body.innerHTML` when the `html` is a full HTML Document.
    if (/<body>[\s\S]*<\/body>/.test(html)) {
      const match = /<body>([\s\S]*)<\/body>/.exec(html)
      if (match && typeof match[1] === 'string') {
        html = match[1]
      }
    }
    const sanitizedHtml = sanitize(html, PREVIEW_DOMPURIFY_CONFIG)
    const tempWrapper = document.createElement('div')
    tempWrapper.innerHTML = sanitizedHtml
    // special process for Number app in macOs
    const tables = Array.from(tempWrapper.querySelectorAll('table'))
    const links = Array.from(tempWrapper.querySelectorAll('a'))

    for (const table of tables) {
      const row = table.querySelector('tr')
      if (row.firstElementChild.tagName !== 'TH') {
        [...row.children].forEach(cell => {
          const th = document.createElement('th')
          th.innerHTML = cell.innerHTML
          cell.replaceWith(th)
        })
      }
      const paragraphs = Array.from(table.querySelectorAll('p'))
      for (const p of paragraphs) {
        const span = document.createElement('span')
        span.innerHTML = p.innerHTML
        p.replaceWith(span)
      }

      const tds = table.querySelectorAll('td')
      for (const td of tds) {
        const rawHtml = td.innerHTML
        if (/<br>/.test(rawHtml)) {
          td.innerHTML = rawHtml.replace(/<br>/g, '&lt;br&gt;')
        }
      }
    }

    // Prevent it parse into a link if copy a url.
    for (const link of links) {
      const href = link.getAttribute('href')
      const text = link.textContent

      if (href === text) {
        const title = await getPageTitle(href)

        if (title) {
          link.textContent = title
        } else {
          const span = document.createElement('span')
          span.innerHTML = text
          link.replaceWith(span)
        }
      }
    }

    return tempWrapper.innerHTML
  }

  ContentState.prototype.pasteImage = async function (event) {
    // Try to guess the clipboard file path.
    const imagePath = this.muya.options.clipboardFilePath()
    if (imagePath && typeof imagePath === 'string' && IMAGE_EXT_REG.test(imagePath)) {
      const id = `loading-${getUniqueId()}`
      if (this.selectedImage) {
        this.replaceImage(this.selectedImage, {
          alt: id,
          src: imagePath
        })
      } else {
        this.insertImage({
          alt: id,
          src: imagePath
        })
      }
      const nSrc = await this.muya.options.imageAction(imagePath)
      const { src } = getImageSrc(imagePath)
      if (src) {
        this.stateRender.urlMap.set(nSrc, src)
      }

      const imageWrapper = this.muya.container.querySelector(`span[data-id=${id}]`)

      if (imageWrapper) {
        const imageInfo = getImageInfo(imageWrapper)
        this.replaceImage(imageInfo, {
          src: nSrc
        })
      }
      return imagePath
    }

    const items = event.clipboardData && event.clipboardData.items
    let file = null
    if (items && items.length) {
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          file = items[i].getAsFile()
          break
        }
      }
    }

    // handle paste to create inline image
    if (file) {
      const id = `loading-${getUniqueId()}`
      if (this.selectedImage) {
        this.replaceImage(this.selectedImage, {
          alt: id,
          src: ''
        })
      } else {
        this.insertImage({
          alt: id,
          src: ''
        })
      }

      const reader = new FileReader()
      reader.onload = event => {
        const base64 = event.target.result
        const imageWrapper = this.muya.container.querySelector(`span[data-id=${id}]`)
        const imageContainer = this.muya.container.querySelector(`span[data-id=${id}] .ag-image-container`)
        this.stateRender.urlMap.set(id, base64)
        if (imageContainer) {
          imageWrapper.classList.remove('ag-empty-image')
          imageWrapper.classList.add('ag-image-success')
          const image = document.createElement('img')
          image.src = base64
          imageContainer.appendChild(image)
        }
      }
      reader.readAsDataURL(file)

      const nSrc = await this.muya.options.imageAction(file)
      const base64 = this.stateRender.urlMap.get(id)
      if (base64) {
        this.stateRender.urlMap.set(nSrc, base64)
        this.stateRender.urlMap.delete(id)
      }
      const imageWrapper = this.muya.container.querySelector(`span[data-id=${id}]`)

      if (imageWrapper) {
        const imageInfo = getImageInfo(imageWrapper)
        this.replaceImage(imageInfo, {
          src: nSrc
        })
      }
      return file
    }
    return null
  }

  ContentState.prototype.docPasteHandler = async function (event) {
    const file = await this.pasteImage(event)
    if (file) {
      return event.preventDefault()
    }
  }

  // handle `normal` and `pasteAsPlainText` paste
  ContentState.prototype.pasteHandler = async function (event, type = 'normal', rawText, rawHtml) {
    event.preventDefault()
    event.stopPropagation()
    const text = rawText || event.clipboardData.getData('text/plain')
    let html = rawHtml || event.clipboardData.getData('text/html')

    html = await this.standardizeHTML(html)
    const copyType = this.checkCopyType(html, text)
    const { start, end } = this.cursor
    const startBlock = this.getBlock(start.key)
    const endBlock = this.getBlock(end.key)
    const parent = this.getParent(startBlock)

    if (start.key !== end.key) {
      this.cutHandler()
      return this.pasteHandler(event, type)
    }

    const file = await this.pasteImage(event)
    if (file) {
      return
    }

    const appendHtml = (text) => {
      startBlock.text = startBlock.text.substring(0, start.offset) + text + startBlock.text.substring(start.offset)
      const { key } = start
      const offset = start.offset + text.length
      this.cursor = {
        start: { key, offset },
        end: { key, offset }
      }
    }

    // Extract the first line from the language identifier (GH#553)
    if (startBlock.type === 'span' && startBlock.functionType === 'languageInput') {
      let language = text.trim().match(/^.*$/m)[0] || ''
      const oldLanguageLength = startBlock.text.length
      let offset = 0
      if (start.offset !== 0 || end.offset !== oldLanguageLength) {
        const prePartText = startBlock.text.substring(0, start.offset)
        const postPartText = startBlock.text.substring(end.offset)

        // Expect that the language doesn't contain new lines
        language = prePartText + language + postPartText
        offset = prePartText.length + language.length
      } else {
        offset = language.length
      }

      startBlock.text = language

      const key = startBlock.key
      this.cursor = {
        start: { key, offset },
        end: { key, offset }
      }

      // Hide code picker float box
      const { eventCenter } = this.muya
      eventCenter.dispatch('muya-code-picker', { reference: null })

      // Update code block language and render
      this.updateCodeLanguage(startBlock, language)
      return
    }

    if (startBlock.type === 'span' && startBlock.functionType === 'codeLine') {
      let referenceBlock = startBlock
      const blockText = startBlock.text
      const prePartText = blockText.substring(0, start.offset)
      const postPartText = blockText.substring(end.offset)
      const textList = text.split(LINE_BREAKS_REG)
      if (textList.length > 1) {
        textList.forEach((line, i) => {
          if (i === 0) {
            startBlock.text = prePartText + line
          } else {
            line = i === textList.length - 1 ? line + postPartText : line
            const lineBlock = this.createBlock('span', { text: line })
            lineBlock.functionType = startBlock.functionType
            lineBlock.lang = startBlock.lang
            this.insertAfter(lineBlock, referenceBlock)
            referenceBlock = lineBlock
            if (i === textList.length - 1) {
              const { key } = lineBlock
              const offset = line.length
              this.cursor = {
                start: { key, offset },
                end: { key, offset }
              }
            }
          }
        })
      } else {
        startBlock.text = prePartText + text + postPartText
        const key = startBlock.key
        const offset = start.offset + text.length
        this.cursor = {
          start: { key, offset },
          end: { key, offset }
        }
      }
      return this.partialRender()
    }

    if (/th|td/.test(startBlock.type)) {
      const pendingText = text.trim().replace(/\n/g, '<br/>')
      startBlock.text = startBlock.text.substring(0, start.offset) + pendingText + startBlock.text.substring(end.offset)
      const { key } = startBlock
      const offset = start.offset + pendingText.length
      this.cursor = {
        start: { key, offset },
        end: { key, offset }
      }
      return this.partialRender()
    }

    // handle copyAsHtml
    if (copyType === 'copyAsHtml') {
      switch (type) {
        case 'normal': {
          const htmlBlock = this.createBlockP(text.trim())
          this.insertAfter(htmlBlock, parent)
          this.removeBlock(parent)
          // handler heading
          this.insertHtmlBlock(htmlBlock)
          break
        }
        case 'pasteAsPlainText': {
          const lines = text.trim().split(LINE_BREAKS_REG)
          let htmlBlock = null

          if (!startBlock.text || lines.length > 1) {
            htmlBlock = this.createBlockP((startBlock.text ? lines.slice(1) : lines).join('\n'))
          }
          if (htmlBlock) {
            this.insertAfter(htmlBlock, parent)
            this.insertHtmlBlock(htmlBlock)
          }
          if (startBlock.text) {
            appendHtml(lines[0])
          } else {
            this.removeBlock(parent)
          }
          break
        }
      }
      return this.partialRender()
    }

    const stateFragments = type === 'pasteAsPlainText' || copyType === 'copyAsMarkdown'
      ? this.markdownToState(text)
      : this.html2State(html)

    if (stateFragments.length <= 0) return
    // step 1: if select content, cut the content, and chop the block text into two part by the cursor.
    const cacheText = endBlock.text.substring(end.offset)
    startBlock.text = startBlock.text.substring(0, start.offset)

    // step 2: when insert the fragments, check begin a new block, or insert into pre block.
    const firstFragment = stateFragments[0]
    const tailFragments = stateFragments.slice(1)
    const pasteType = this.checkPasteType(startBlock, firstFragment)

    const getLastBlock = blocks => {
      const len = blocks.length
      const lastBlock = blocks[len - 1]

      if (lastBlock.children.length === 0 && HAS_TEXT_BLOCK_REG.test(lastBlock.type)) {
        return lastBlock
      } else {
        if (lastBlock.editable === false) {
          return getLastBlock(blocks[len - 2].children)
        } else {
          return getLastBlock(lastBlock.children)
        }
      }
    }

    const lastBlock = getLastBlock(stateFragments)
    let key = lastBlock.key
    let offset = lastBlock.text.length
    lastBlock.text += cacheText

    switch (pasteType) {
      case 'MERGE': {
        if (LIST_REG.test(firstFragment.type)) {
          const listItems = firstFragment.children
          const firstListItem = listItems[0]
          const liChildren = firstListItem.children
          const originListItem = this.getParent(parent)
          const originList = this.getParent(originListItem)
          const targetListType = firstFragment.children[0].isLooseListItem
          const originListType = originList.children[0].isLooseListItem
          // No matter copy loose list to tight list or vice versa, the result is one loose list.
          if (targetListType !== originListType) {
            if (!targetListType) {
              firstFragment.children.forEach(item => (item.isLooseListItem = true))
            } else {
              originList.children.forEach(item => (item.isLooseListItem = true))
            }
          }

          if (liChildren[0].type === 'p') {
            // TODO @JOCS
            startBlock.text += liChildren[0].children[0].text
            const tail = liChildren.slice(1)
            if (tail.length) {
              tail.forEach(t => {
                this.appendChild(originListItem, t)
              })
            }
            const firstFragmentTail = listItems.slice(1)
            if (firstFragmentTail.length) {
              firstFragmentTail.forEach(t => {
                this.appendChild(originList, t)
              })
            }
          } else {
            listItems.forEach(c => {
              this.appendChild(originList, c)
            })
          }
          let target = originList
          tailFragments.forEach(block => {
            this.insertAfter(block, target)
            target = block
          })
        } else if (firstFragment.type === 'p' || /^h\d/.test(firstFragment.type)) {
          const text = firstFragment.children[0].text
          const lines = text.split('\n')
          let target = parent
          if (parent.headingStyle === 'atx') {
            startBlock.text += lines[0]
            if (lines.length > 1) {
              const pBlock = this.createBlockP(lines.slice(1).join('\n'))
              this.insertAfter(parent, pBlock)
              target = pBlock
            }
          } else {
            startBlock.text += text
          }

          tailFragments.forEach(block => {
            this.insertAfter(block, target)
            target = block
          })
        }
        break
      }
      case 'NEWLINE': {
        let target = parent
        stateFragments.forEach(block => {
          this.insertAfter(block, target)
          target = block
        })
        if (startBlock.text.length === 0) {
          this.removeBlock(parent)
        }
        break
      }
      default: {
        throw new Error('unknown paste type')
      }
    }
    // step 3: set cursor and render
    let cursorBlock = this.getBlock(key)
    if (!cursorBlock) {
      key = startBlock.key
      offset = startBlock.text.length - cacheText.length
      cursorBlock = startBlock
    }

    this.cursor = {
      start: {
        key, offset
      },
      end: {
        key, offset
      }
    }
    this.checkInlineUpdate(cursorBlock)
    this.partialRender()
    this.muya.dispatchSelectionChange()
    this.muya.dispatchSelectionFormats()
    return this.muya.dispatchChange()
  }
}

export default pasteCtrl
