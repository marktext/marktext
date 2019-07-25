import { block } from './blockRules'
import { edit, noop } from './utils'

/* eslint-disable no-useless-escape */

/**
 * Inline-Level Grammar
 */

const inline = {
  escape: /^\\([!"#$%&'()*+,\-./:;<=>?@\[\]\\^_`{|}~])/,
  autolink: /^<(scheme:[^\s\x00-\x1f<>]*|email)>/, // eslint-disable-line no-control-regex
  url: noop,
  tag: '^comment' +
    '|^</[a-zA-Z][\\w:-]*\\s*>' + // self-closing tag
    '|^<[a-zA-Z][\\w-]*(?:attribute)*?\\s*/?>' + // open tag
    '|^<\\?[\\s\\S]*?\\?>' + // processing instruction, e.g. <?php ?>
    '|^<![a-zA-Z]+\\s[\\s\\S]*?>' + // declaration, e.g. <!DOCTYPE html>
    '|^<!\\[CDATA\\[[\\s\\S]*?\\]\\]>', // CDATA section
  link: /^!?\[(label)\]\(\s*(href)(?:\s+(title))?\s*\)/,
  reflink: /^!?\[(label)\]\[(?!\s*\])((?:\\[\[\]]?|[^\[\]\\])+)\]/,
  nolink: /^!?\[(?!\s*\])((?:\[[^\[\]]*\]|\\[\[\]]|[^\[\]])*)\](?:\[\])?/,
  strong: /^__([^\s_])__(?!_)|^\*\*([^\s*])\*\*(?!\*)|^__([^\s][\s\S]*?[^\s])__(?!_)|^\*\*([^\s][\s\S]*?[^\s])\*\*(?!\*)/,
  em: /^_([^\s_])_(?!_)|^\*([^\s*"<\[])\*(?!\*)|^_([^\s][\s\S]*?[^\s_])_(?!_|[^\spunctuation])|^_([^\s_][\s\S]*?[^\s])_(?!_|[^\spunctuation])|^\*([^\s"<\[][\s\S]*?[^\s*])\*(?!\*)|^\*([^\s*"<\[][\s\S]*?[^\s])\*(?!\*)/,
  code: /^(`+)([^`]|[^`][\s\S]*?[^`])\1(?!`)/,
  br: /^( {2,}|\\)\n(?!\s*$)/,
  del: noop,

  // ------------------------
  // patched

  // allow inline math "$" ("?=[\\<!\[`*]" to "?=[\\<!\[`*\$]")
  text: /^(`+|[^`])(?:[\s\S]*?(?:(?=[\\<!\[`*\$]|\b_|$)|[^ ](?= {2,}\n))|(?= {2,}\n))/, // emoji is patched in gfm

  // ------------------------
  // extra
  emoji: noop,

  // TODO: make math optional GH#740
  math: /^\$([^$]{1}[\s\S]+?[^$]{1})\$(?!\$)/
}

// list of punctuation marks from common mark spec
// without ` and ] to workaround Rule 17 (inline code blocks/links)
inline._punctuation = '!"#$%&\'()*+,\\-./:;<=>?@\\[^_{|}~'
inline.em = edit(inline.em).replace(/punctuation/g, inline._punctuation).getRegex()

inline._escapes = /\\([!"#$%&'()*+,\-./:;<=>?@\[\]\\^_`{|}~])/g

inline._scheme = /[a-zA-Z][a-zA-Z0-9+.-]{1,31}/
inline._email = /[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+(@)[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+(?![-_])/
inline.autolink = edit(inline.autolink)
  .replace('scheme', inline._scheme)
  .replace('email', inline._email)
  .getRegex()

inline._attribute = /\s+[a-zA-Z:_][\w.:-]*(?:\s*=\s*"[^"]*"|\s*=\s*'[^']*'|\s*=\s*[^\s"'=<>`]+)?/

inline.tag = edit(inline.tag)
  .replace('comment', block._comment)
  .replace('attribute', inline._attribute)
  .getRegex()

inline._label = /(?:\[[^\[\]]*\]|\\.|`[^`]*`|[^\[\]\\`])*?/
inline._href = /<(?:\\[<>]?|[^\s<>\\])*>|[^\s\x00-\x1f]*/ // eslint-disable-line no-control-regex
inline._title = /"(?:\\"?|[^"\\])*"|'(?:\\'?|[^'\\])*'|\((?:\\\)?|[^)\\])*\)/

inline.link = edit(inline.link)
  .replace('label', inline._label)
  .replace('href', inline._href)
  .replace('title', inline._title)
  .getRegex()

inline.reflink = edit(inline.reflink)
  .replace('label', inline._label)
  .getRegex()

/**
 * Normal Inline Grammar
 */

export const normal = Object.assign({}, inline)

/**
 * Pedantic Inline Grammar
 */

export const pedantic = Object.assign({}, normal, {
  strong: /^__(?=\S)([\s\S]*?\S)__(?!_)|^\*\*(?=\S)([\s\S]*?\S)\*\*(?!\*)/,
  em: /^_(?=\S)([\s\S]*?\S)_(?!_)|^\*(?=\S)([\s\S]*?\S)\*(?!\*)/,
  link: edit(/^!?\[(label)\]\((.*?)\)/)
    .replace('label', inline._label)
    .getRegex(),
  reflink: edit(/^!?\[(label)\]\s*\[([^\]]*)\]/)
    .replace('label', inline._label)
    .getRegex()
})

/**
 * GFM Inline Grammar
 */

export const gfm = Object.assign({}, normal, {
  escape: edit(inline.escape).replace('])', '~|])').getRegex(),
  _extended_email: /[A-Za-z0-9._+-]+(@)[a-zA-Z0-9-_]+(?:\.[a-zA-Z0-9-_]*[a-zA-Z0-9])+(?![-_])/,
  url: /^((?:ftp|https?):\/\/|www\.)(?:[a-zA-Z0-9\-]+\.?)+[^\s<]*|^email/,
  _backpedal: /(?:[^?!.,:;*_~()&]+|\([^)]*\)|&(?![a-zA-Z0-9]+;$)|[?!.,:;*_~)]+(?!$))+/,
  del: /^~+(?=\S)([\s\S]*?\S)~+/,

  // ------------------------
  // patched

  // allow inline math "$" and emoji ":" ("?=[\\<!\[`*~]|" to "?=[\\<!\[`*~:\$]|")
  text: /^(`+|[^`])(?:[\s\S]*?(?:(?=[\\<!\[`*~:\$]|\b_|https?:\/\/|ftp:\/\/|www\.|$)|[^ ](?= {2,}\n)|[^a-zA-Z0-9.!#$%&'*+\/=?_`{\|}~-](?=[a-zA-Z0-9.!#$%&'*+\/=?_`{\|}~-]+@))|(?= {2,}\n|[a-zA-Z0-9.!#$%&'*+\/=?_`{\|}~-]+@))/,

  // ------------------------
  // extra

  emoji: /^(:)([a-z_\d+-]+?)\1/ // not real GFM but put it in here
})

gfm.url = edit(gfm.url, 'i')
  .replace('email', gfm._extended_email)
  .getRegex()

/**
 * GFM + Line Breaks Inline Grammar
 */

export const breaks = Object.assign({}, gfm, {
  br: edit(inline.br).replace('{2,}', '*').getRegex(),
  text: edit(gfm.text).replace(/\{2,\}/g, '*').getRegex()
})

/* eslint-ensable no-useless-escape */
