/**
 * translate markdown format to content state used by editor
 */

import parse5 from 'parse5'
import TurndownService from 'turndown'
import marked from '../parser/marked'

// To be disabled rules when parse markdown, Because content state don't need to parse inline rules
import { turndownConfig, CLASS_OR_ID } from '../config'

const turndownPluginGfm = require('turndown-plugin-gfm')

// turn html to markdown
const turndownService = new TurndownService(turndownConfig)
const gfm = turndownPluginGfm.gfm
// Use the gfm plugin
turndownService.use(gfm)
// because the strikethrough rule in gfm is single `~`, So need rewrite the strikethrough rule.
turndownService.addRule('strikethrough', {
  filter: ['del', 's', 'strike'],
  replacement: function (content) {
    return '~~' + content + '~~'
  }
})

// remove `\` in emoji text when paste
turndownService.addRule('normalEmoji', {
  filter (node, options) {
    return node.nodeName === 'SPAN' &&
      node.classList.contains(CLASS_OR_ID['AG_EMOJI_MARKED_TEXT'])
  },
  replacement (content, node, options) {
    return content.replace(/\\/g, '')
  }
})

const importRegister = ContentState => {
  ContentState.prototype.getStateFragment = function (markdown) {
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

    const htmlText = marked(markdown, { disableInline: true })
    const domAst = parse5.parseFragment(htmlText)

    const childNodes = domAst.childNodes

    const getLang = node => {
      let lang = ''
      if (node.nodeName === 'code') {
        const classAttr = node.attrs.filter(attr => attr.name === 'class')[0]
        if (classAttr && /^language/.test(classAttr.value)) {
          lang = classAttr.value.split('-')[1]
        }
      }
      return lang
    }

    const travel = (parent, childNodes) => {
      const len = childNodes.length
      let i

      for (i = 0; i < len; i++) {
        const child = childNodes[i]
        let block
        let value

        switch (child.nodeName) {
          case 'p':
          case 'h1':
          case 'h2':
          case 'h3':
          case 'h4':
          case 'h5':
          case 'h6':
            const textValue = child.childNodes[0].value
            const match = /\d/.exec(child.nodeName)
            value = match ? '#'.repeat(+match[0]) + textValue : textValue
            block = this.createBlock(child.nodeName, value)
            this.appendChild(parent, block)
            break

          case 'hr':
            const initValue = '---'
            block = this.createBlock(child.nodeName, initValue)
            this.appendChild(parent, block)
            break

          case 'input':
            const isTaskListItemCheckbox = child.attrs.some(attr => attr.name === 'class' && attr.value === 'task-list-item-checkbox')
            const checked = child.attrs.some(attr => attr.name === 'checked' && attr.value === '')

            if (isTaskListItemCheckbox) {
              parent.listItemType = 'task' // double check
              block = this.createBlock('input')
              block.checked = checked
              this.appendChild(parent, block)
            }
            break

          case 'li':
            const isTask = child.attrs.some(attr => attr.name === 'class' && attr.value === 'task-list-item')
            block = this.createBlock('li')
            block.listItemType = parent.nodeName === 'ul' ? (isTask ? 'task' : 'bullet') : 'order'
            this.appendChild(parent, block)
            travel(block, child.childNodes)
            break

          case 'ul':
            const isTaskList = child.attrs.some(attr => attr.name === 'class' && attr.value === 'task-list')
            block = this.createBlock('ul')
            block.listType = isTaskList ? 'task' : 'bullet'
            travel(block, child.childNodes)
            this.appendChild(parent, block)
            break

          case 'ol':
            block = this.createBlock('ol')
            block.listType = 'order'
            child.attrs.forEach(attr => {
              block[attr.name] = attr.value
            })
            if (!block.start) {
              block.start = 1
            }
            travel(block, child.childNodes)
            this.appendChild(parent, block)
            break

          case 'blockquote':
            block = this.createBlock('blockquote')
            travel(block, child.childNodes)
            this.appendChild(parent, block)
            break

          case 'pre':
            const codeNode = child.childNodes[0]
            value = codeNode.childNodes[0].value

            if (value.endsWith('\n')) {
              value = value.replace(/\n+$/, '')
            }
            block = this.createBlock('pre', value)
            block.lang = getLang(codeNode)
            this.appendChild(parent, block)
            break

          case '#text':
            const { parentNode } = child
            value = child.value

            if (parentNode.nodeName === 'li' && /\S/.test(value)) {
              block = this.createBlock('p', value)
              this.appendChild(parent, block)
            }
            break

          default:
            if (child.tagName) {
              throw new Error(`unHandle node type ${child.tagName}`)
            }
            break
        }
      }
    }

    travel(rootState, childNodes)
    return rootState.children
  }
  // transform `paste's text/html data` to content state blocks.
  ContentState.prototype.html2State = function (html) {
    const markdown = turndownService.turndown(html)
    return this.getStateFragment(markdown)
  }

  ContentState.prototype.importMarkdown = function (markdown) {
    // empty the blocks and codeBlocks
    this.keys = new Set()
    this.codeBlocks = new Map()
    this.blocks = this.getStateFragment(markdown)
    // set cursor
    const lastBlock = this.getLastBlock()
    const key = lastBlock.key
    const offset = lastBlock.text.length
    this.cursor = {
      start: { key, offset },
      end: { key, offset }
    }
    // re-render
    this.render()
  }
}

export default importRegister
