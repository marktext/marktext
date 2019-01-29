import { replace, noop } from './utils'
/**
 * Inline-Level Grammar
 */
/* eslint-disable no-useless-escape */
const inline = {
  escape: /^\\([\\`*{}\[\]()#+\-.!_>])/,
  autolink: /^<([^ >]+(@|:\/)[^ >]+)>/,
  url: noop,
  tag: /^<!--[\s\S]*?-->|^<\/?\w+(?:"[^"]*"|'[^']*'|[^'">])*?>/,
  link: /^!?\[(inside)\]\(href\)/,
  reflink: /^!?\[(inside)\]\s*\[([^\]]*)\]/,
  nolink: /^!?\[((?:\[[^\]]*\]|[^\[\]])*)\]/,
  math: /^\$([\s\S]+?)\$(?!\$)/,
  strong: /^__([\s\S]+?)__(?!_)|^\*\*([\s\S]+?)\*\*(?!\*)/,
  em: /^\b_((?:__|[\s\S])+?)_\b|^\*((?:\*\*|[\s\S])+?)\*(?!\*)/,
  code: /^(`+)\s*([\s\S]*?[^`])\s*\1(?!`)/,
  br: /^ {2,}\n(?!\s*$)/,
  del: noop,
  text: /^[\s\S]+?(?=[\\<!\[_*`\$]| {2,}\n|$)/
}

inline._inside = /(?:\[[^\]]*\]|[^\[\]]|\](?=[^\[]*\]))*/
inline._href = /\s*<?([\s\S]*?)>?(?:\s+['"]([\s\S]*?)['"])?\s*/

inline.link = replace(inline.link)('inside', inline._inside)('href', inline._href)()

inline.reflink = replace(inline.reflink)('inside', inline._inside)()

/**
 * Normal Inline Grammar
 */

export const normal = Object.assign({}, inline)

/**
 * Pedantic Inline Grammar
 */

export const pedantic = Object.assign({}, normal, {
  strong: /^__(?=\S)([\s\S]*?\S)__(?!_)|^\*\*(?=\S)([\s\S]*?\S)\*\*(?!\*)/,
  em: /^_(?=\S)([\s\S]*?\S)_(?!_)|^\*(?=\S)([\s\S]*?\S)\*(?!\*)/
})

/**
 * GFM Inline Grammar
 */

export const gfm = Object.assign({}, normal, {
  escape: replace(inline.escape)('])', '~|])')(),
  url: /^(https?:\/\/[^\s<]+[^<.,:;"')\]\s])/,
  del: /^~~(?=\S)([\s\S]*?\S)~~/,
  emoji: /^(:)([a-z_]+?)\1/,
  text: replace(inline.text)(']|', '~]|')('|', '|https?://|')()
})

/**
 * GFM + Line Breaks Inline Grammar
 */

export const breaks = Object.assign({}, gfm, {
  br: replace(inline.br)('{2,}', '*')(),
  text: replace(gfm.text)('{2,}', '*')()
})
/* eslint-ensable no-useless-escape */
