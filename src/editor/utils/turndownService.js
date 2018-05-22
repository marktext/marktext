import TurndownService from 'turndown'
import { CLASS_OR_ID, LINE_BREAK } from '../config'

const turndownPluginGfm = require('turndown-plugin-gfm')

export const usePluginAddRules = turndownService => {
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

  // handle `soft line break` and `hard line break`
  // add `LINE_BREAK` to the end of soft line break and hard line break.
  turndownService.addRule('lineBreak', {
    filter (node, options) {
      return node.nodeName === 'SPAN' && node.classList.contains(CLASS_OR_ID['AG_LINE']) && node.nextElementSibling
    },
    replacement (content, node, options) {
      return content + LINE_BREAK
    }
  })

  // remove `\` in text when paste
  turndownService.addRule('normalText', {
    filter (node, options) {
      return (node.nodeName === 'SPAN' &&
        node.classList.contains(CLASS_OR_ID['AG_EMOJI_MARKED_TEXT'])) ||
        node.classList.contains('plain-text')
    },
    replacement (content, node, options) {
      return content.replace(/\\(?!\\)/g, '')
    }
  })
}

export default TurndownService
