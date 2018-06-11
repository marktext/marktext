/**
 * Block-Level Rules
 */
/* eslint-disable no-useless-escape */
import { replace, noop } from './utils'

const block = {
  newline: /^\n+/,
  code: /^( {4}[^\n]+\n*)+/,
  fences: noop,
  hr: /^( *[-*_]){3,} *(?:\n+|$)/,
  heading: /^ *(#{1,6}) *([^\n]+?) *#* *(?:\n+|$)/,
  nptable: noop,
  // DOTO(@Jocs) need to support multiple line in setext heading?
  lheading: /^([^\n]+)\n *(=|-){2,} *(?:\n+|$)/,
  blockquote: /^( *>[^\n]+(\n(?!def)[^\n]+)*\n*)+/,
  tasklist: /^( *)([*+-] \[(?:X|x|\s)\]) [\s\S]+?(?:hr|def|\n{2,}(?! )(?!\1(?:[*+-] \[(?:X|x|\s)\]))\n*|\s*$)/,
  orderlist: /^( *)(\d+\.) [\s\S]+?(?:hr|def|\n{2,}(?! )(?!\1\d+\. )\n*|\s*$)/,
  bulletlist: /^( *)([*+-]) [\s\S]+?(?:hr|def|\n{2,}(?! )(?!\1[*+-] )\n*|\s*$)/,
  html: /^ *(?:comment *(?:\n|\s*$)|closed *(?:\n{2,}|\s*$)|closing *(?:\n{2,}|\s*$))/,
  def: /^ {0,3}\[([^\]]+)\]: *<?([^\s>]+)>?(?: +["(]([^\n]+)[")])? *(?:\n+|$)/,
  table: noop,
  paragraph: /^((?:[^\n]+\n?(?!hr|heading|lheading|blockquote|tag|def))+)\n*/,
  text: /^[^\n]+/,
  frontmatter: /^---\n([\s\S]+?)---(?:\n+|$)/,
  multiplemath: /^\$\$\n([\s\S]+?)\n\$\$(?:\n+|$)/
}

block.checkbox = /^\[([ x])\] +/
block.bullet = /(?:[*+-] \[(?:X|x|\s)\]|[*+-]|\d+\.)/
block.item = /^( *)(bull) [^\n]*(?:\n(?!\1bull )[^\n]*)*/
block.item = replace(block.item, 'gm')(/bull/g, block.bullet)()

;['tasklist', 'orderlist', 'bulletlist'].forEach(list => {
  block[list] = replace(block[list])('hr', '\\n+(?=\\1?(?:[-*_] *){3,}(?:\\n+|$))')('def', '\\n+(?=' + block.def.source + ')')()
})

block.blockquote = replace(block.blockquote)('def', block.def)()

block._tag = '(?!(?:' +
  'a|em|strong|small|s|cite|q|dfn|abbr|data|time|code' +
  '|var|samp|kbd|sub|sup|i|b|u|mark|ruby|rt|rp|bdi|bdo' +
  '|span|br|wbr|ins|del|img)\\b)\\w+(?!:/|[^\\w\\s@]*@)\\b'

block.html = replace(block.html)('comment', /<!--[\s\S]*?-->/)('closed', /<(tag)[\s\S]+?<\/\1>/)('closing', /<tag(?:"[^"]*"|'[^']*'|[^'">])*?>/)(/tag/g, block._tag)()

block.paragraph = replace(block.paragraph)('hr', block.hr)('heading', block.heading)('lheading', block.lheading)('blockquote', block.blockquote)('tag', '<' + block._tag)('def', block.def)()

/**
 * Normal Block Grammar
 */

export const normal = Object.assign({}, block)

/**
 * GFM Block Grammar
 */

export const gfm = Object.assign({}, normal, {
  fences: /^ *(`{3,}|~{3,})[ \.]*(\S+)? *\n([\s\S]+?)\s*\1 *(?:\n+|$)/,
  paragraph: /^/,
  heading: /^ *(#{1,6}) +([^\n]+?) *#* *(?:\n+|$)/
})

// fix me @Jocs
gfm.paragraph = replace(block.paragraph)('(?!', '(?!' +
  gfm.fences.source.replace('\\1', '\\2') + '|' +
  block.tasklist.source.replace('\\1', '\\5') + '|' +
  block.orderlist.source.replace('\\1', '\\7') + '|' +
  block.bulletlist.source.replace('\\1', '\\9') + '|')()

/**
 * GFM + Tables Block Grammar
 */

export const tables = Object.assign({}, gfm, {
  nptable: /^ *(\S.*\|.*)\n *([-:]+ *\|[-| :]*)\n((?:.*\|.*(?:\n|$))*)\n*/,
  table: /^ *\|(.+)\n *\|( *[-:]+[-| :]*)\n((?: *\|.*(?:\n|$))*)\n*/
})
/* eslint-ensable no-useless-escape */
