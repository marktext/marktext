import { sanitize } from '../utils'
import { PARAGRAPH_TYPES, PREVIEW_DOMPURIFY_CONFIG } from '../config'

const LIST_REG = /ul|ol/
const LINE_BREAKS_REG = /\n/

const pasteCtrl = ContentState => {
  // check paste type: `MERGE` or `NEWLINE`
  ContentState.prototype.checkPasteType = function (start, fragment) {
    const fragmentType = fragment.type
    if (start.type === 'span') {
      start = this.getParent(start)
    }
    if (fragmentType === 'p') return 'MERGE'
    if (fragmentType === 'blockquote') return 'NEWLINE'
    let parent = this.getParent(start)
    if (parent && parent.type === 'li') parent = this.getParent(parent)
    let startType = start.type
    if (start.type === 'p') {
      startType = parent ? parent.type : startType
    }
    if (LIST_REG.test(fragmentType) && LIST_REG.test(startType)) {
      return 'MERGE'
    } else {
      return startType === fragmentType ? 'MERGE' : 'NEWLINE'
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

  ContentState.prototype.standardizeHTML = function (html) {
    const sanitizedHtml = sanitize(html, PREVIEW_DOMPURIFY_CONFIG)
    const tempWrapper = document.createElement('div')
    tempWrapper.innerHTML = sanitizedHtml
    // special process for Number app in macOs
    const tables = Array.from(tempWrapper.querySelectorAll('table'))
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
    }

    return tempWrapper.innerHTML
  }

  // handle `normal` and `pasteAsPlainText` paste
  ContentState.prototype.pasteHandler = function (event, type) {
    event.preventDefault()
    const text = event.clipboardData.getData('text/plain')
    let html = event.clipboardData.getData('text/html')
    html = this.standardizeHTML(html)
    const copyType = this.checkCopyType(html, text)
    const { start, end } = this.cursor
    const startBlock = this.getBlock(start.key)
    const endBlock = this.getBlock(end.key)
    const parent = this.getParent(startBlock)

    if (start.key !== end.key) {
      this.cutHandler()
      return this.pasteHandler(event, type)
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
            const lineBlock = this.createBlock('span', line)
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
      this.updateCodeBlocks(startBlock)
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
      // already handle code block above
      if (startBlock.type === 'span' && startBlock.nextSibling) {
        const afterParagraph = this.createBlock('p')
        let temp = startBlock
        const removeCache = []
        while (temp.nextSibling) {
          temp = this.getBlock(temp.nextSibling)
          this.appendChild(afterParagraph, temp)
          removeCache.push(temp)
        }
        removeCache.forEach(b => this.removeBlock(b))
        this.insertAfter(afterParagraph, parent)
        startBlock.nextSibling = null
      }
      switch (type) {
        case 'normal': {
          const htmlBlock = this.createBlock('p')
          const lines = text.trim().split(LINE_BREAKS_REG).map(line => this.createBlock('span', line))
          for (const line of lines) {
            this.appendChild(htmlBlock, line)
          }
          if (startBlock.type === 'span') {
            this.insertAfter(htmlBlock, parent)
          } else {
            this.insertAfter(htmlBlock, startBlock)
          }
          if (
            startBlock.type === 'span' && startBlock.text.length === 0 && this.isOnlyChild(startBlock)
          ) {
            this.removeBlock(parent)
          }
          // handler heading
          if (startBlock.text.length === 0 && startBlock.type !== 'span') {
            this.removeBlock(startBlock)
          }
          this.insertHtmlBlock(htmlBlock)
          break
        }
        case 'pasteAsPlainText': {
          const lines = text.trim().split(LINE_BREAKS_REG)
          let htmlBlock = null
          
          if (!startBlock.text || lines.length > 1) {
            htmlBlock = this.createBlock('p')
            ;(startBlock.text ? lines.slice(1) : lines).map(line => this.createBlock('span', line))
              .forEach(l => {
                this.appendChild(htmlBlock, l)
              })
          }
          if (htmlBlock) {
            if (startBlock.type === 'span') {
              this.insertAfter(htmlBlock, parent)
            } else {
              this.insertAfter(htmlBlock, startBlock)
            }
            this.insertHtmlBlock(htmlBlock)
          }
          if (startBlock.text) {
            appendHtml(lines[0])
          } else {
            this.removeBlock(startBlock.type === 'span' ? parent : startBlock)
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

      if (lastBlock.children.length === 0) {
        return lastBlock
      } else {
        return getLastBlock(lastBlock.children)
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
              firstFragment.children.forEach(item => item.isLooseListItem = true)
            } else {
              originList.children.forEach(item => item.isLooseListItem = true)
            }
          }

          if (liChildren[0].type === 'p') {
            // TODO @JOCS
            startBlock.text += liChildren[0].children[0].text
            liChildren[0].children.slice(1).forEach(c => this.appendChild(parent, c))
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
        } else {
          if (firstFragment.type === 'p') {
            if (/^h\d$/.test(startBlock.type)) {
              // handle paste into header
              startBlock.text += firstFragment.children[0].text
              if (firstFragment.children.length > 1) {
                const newParagraph = this.createBlock('p')
                firstFragment.children.slice(1).forEach(line => {
                  this.appendChild(newParagraph, line)
                })
                this.insertAfter(newParagraph, startBlock)
              }
            } else {
              startBlock.text += firstFragment.children[0].text
              firstFragment.children.slice(1).forEach(line => {
                if (startBlock.functionType) line.functionType = startBlock.functionType
                if (startBlock.lang) line.lang = startBlock.lang
                this.appendChild(parent, line)
              })
            }
          } else if (/^h\d$/.test(firstFragment.type)) {
            startBlock.text += firstFragment.text.split(/\s+/)[1]
          } else {
            startBlock.text += firstFragment.text
          }

          let target = /^h\d$/.test(startBlock.type) ? startBlock : parent
          tailFragments.forEach(block => {
            this.insertAfter(block, target)
            target = block
          })
        }
        break
      }
      case 'NEWLINE': {
        let target = startBlock.type === 'span' ? parent : startBlock
        stateFragments.forEach(block => {
          this.insertAfter(block, target)
          target = block
        })
        if (startBlock.text.length === 0) {
          this.removeBlock(startBlock)
          if (this.isOnlyChild(startBlock) && startBlock.type === 'span') this.removeBlock(parent)
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
    // TODO @Jocs duplicate with codes in updateCtrl.js
    if (cursorBlock && cursorBlock.type === 'span' && cursorBlock.functionType === 'codeLine') {
      this.updateCodeBlocks(cursorBlock)
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
  }
}

export default pasteCtrl
