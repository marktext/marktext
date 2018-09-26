/**
 * translate markdown format to content state used by Mark Text
 * there is some difference when parse loose list item and tight lsit item.
 * Both of them add a p block in li block, use the CSS style to distinguish loose and tight.
 */
import ExportMarkdown from './exportMarkdown'
import TurndownService, { usePluginAddRules } from './turndownService'

// To be disabled rules when parse markdown, Because content state don't need to parse inline rules
import { CURSOR_DNA } from '../config'
import blockProcesser from '../parser/blockProcesser'

const importRegister = ContentState => {
  // turn markdown to blocks

  ContentState.prototype.htmlToMarkdown = function (html) {
    // turn html to markdown
    const { turndownConfig } = this
    const turndownService = new TurndownService(turndownConfig)
    usePluginAddRules(turndownService)
    // remove double `\\` in Math but I dont know why there are two '\' when paste. @jocs
    const markdown = turndownService.turndown(html).replace(/(\\)\\/g, '$1')
    return markdown
  }

  // turn html to blocks
  ContentState.prototype.html2State = function (html) {
    const markdown = this.htmlToMarkdown(html)
    return this.markdownToState(markdown)
  }

  ContentState.prototype.addCursorToMarkdown = function (markdown, cursor) {
    const { ch, line } = cursor
    const lines = markdown.split('\n')
    const rawText = lines[line]
    lines[line] = rawText.substring(0, ch) + CURSOR_DNA + rawText.substring(ch)
    return lines.join('\n')
  }

  ContentState.prototype.getCodeMirrorCursor = function () {
    const blocks = this.getBlocks()
    const { start: { key, offset } } = this.cursor
    const block = this.getBlock(key)
    const { text } = block
    block.text = text.substring(0, offset) + CURSOR_DNA + text.substring(offset)
    const markdown = new ExportMarkdown(blocks).generate()
    const cursor = markdown.split('\n').reduce((acc, line, index) => {
      const ch = line.indexOf(CURSOR_DNA)
      if (ch > -1) {
        Object.assign(acc, { line: index, ch })
      }
      return acc
    }, {
      line: 0,
      ch: 0
    })
    // remove CURSOR_DNA
    block.text = text
    return cursor
  }

  ContentState.prototype.importCursor = function (cursor) {
    // set cursor
    const travel = blocks => {
      for (const block of blocks) {
        const { key, text, children, editable, type, functionType } = block
        if (text) {
          const offset = text.indexOf(CURSOR_DNA)
          if (offset > -1) {
            block.text = text.substring(0, offset) + text.substring(offset + CURSOR_DNA.length)
            if (editable) {
              this.cursor = {
                start: { key, offset },
                end: { key, offset }
              }
              // handle cursor in Math block, need to remove `CURSOR_DNA` in preview block
              if (type === 'span' && functionType === 'multiplemath') {
                const mathPreview = this.getNextSibling(this.getParent(block))
                const { math } = mathPreview
                const offset = math.indexOf(CURSOR_DNA)
                if (offset > -1) {
                  mathPreview.math = math.substring(0, offset) + math.substring(offset + CURSOR_DNA.length)
                }
              }
              return
            }
          }
        } else if (children.length) {
          travel(children)
        }
      }
    }
    if (cursor) {
      travel(this.blocks)
    } else {
      const lastBlock = this.getLastBlock()
      const key = lastBlock.key
      const offset = lastBlock.text.length
      this.cursor = {
        start: { key, offset },
        end: { key, offset }
      }
    }
  }

  ContentState.prototype.markdownToState = function (markdown) {
    // mock a root block...
    const rootState = {
      key: null,
      type: 'root',
      text: '',
      parent: null,
      preSibling: null,
      nextSibling: null,
      children: []
    }
    let states = blockProcesser(markdown, rootState, this)
    // console.log('states ..', states.children.length, JSON.stringify(states.children, null, 2))
    return states.children.length ? states.children : [this.createBlockP()]
  }

  ContentState.prototype.importMarkdown = function (markdown) {
    // empty the blocks and codeBlocks
    this.codeBlocks = new Map()
    // this.blocks = this.markdownToState(markdown)
    this.blocks = this.markdownToState(markdown)
  }
}

export default importRegister
