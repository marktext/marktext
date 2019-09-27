import TurndownService from 'turndown'
import { CLASS_OR_ID, LINE_BREAK } from '../config'
import { identity } from './index'

const turndownPluginGfm = require('joplin-turndown-plugin-gfm')

export const usePluginAddRules = (turndownService, keeps) => {
  // Use the gfm plugin
  const { gfm } = turndownPluginGfm
  turndownService.use(gfm)

  // We need a extra strikethrough rule because the strikethrough rule in gfm is single `~`.
  turndownService.addRule('strikethrough', {
    filter: ['del', 's', 'strike'],
    replacement (content) {
      return '~~' + content + '~~'
    }
  })

  // Handle multiple math lines
  turndownService.addRule('multiplemath', {
    filter (node, options) {
      return node.nodeName === 'PRE' && node.classList.contains('multiple-math')
    },
    replacement (content, node, options) {
      return `$$\n${content}\n$$`
    }
  })

  // Add `LINE_BREAK` to the end of every code line but not the last line.
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
