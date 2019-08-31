import TurndownService from 'turndown'
import { CLASS_OR_ID, LINE_BREAK } from '../config'
import { identity } from './index'

const turndownPluginGfm = require('turndown-plugin-gfm')

export const usePluginAddRules = (turndownService, keeps) => {
  // Use the gfm plugin
  const { gfm } = turndownPluginGfm
  turndownService.use(gfm)
  // because the strikethrough rule in gfm is single `~`, So need rewrite the strikethrough rule.
  turndownService.addRule('strikethrough', {
    filter: ['del', 's', 'strike'],
    replacement (content) {
      return '~~' + content + '~~'
    }
  })

  // handle multiple lines math
  turndownService.addRule('multiplemath', {
    filter (node, options) {
      return node.nodeName === 'PRE' && node.classList.contains('multiple-math')
    },
    replacement (content, node, options) {
      return `$$\n${content}\n$$`
    }
  })

  // handle `line break` in code block
  // add `LINE_BREAK` to the end of every code line but not the last line.
  turndownService.addRule('codeLineBreak', {
    filter (node, options) {
      return (
        node.nodeName === 'SPAN' && node.classList.contains(CLASS_OR_ID.AG_CODE_LINE) && node.nextElementSibling
      )
    },
    replacement (content, node, options) {
      return content + LINE_BREAK
    }
  })

  turndownService.escape = identity

  turndownService.keep(keeps)
}

export default TurndownService
