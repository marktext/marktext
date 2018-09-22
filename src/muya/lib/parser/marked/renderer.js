import { escape, unescape } from './utils'
/**
 * Renderer
 */

function Renderer (options = {}) {
  this.options = options
}

Renderer.prototype.frontmatter = function (text) {
  return `<pre class="front-matter">\n${text}</pre>\n`
}

Renderer.prototype.multiplemath = function (text) {
  let output = ''
  if (this.options.mathRenderer) {
    const displayMode = true
    output = this.options.mathRenderer(text, displayMode)
  }
  return output || `<pre class="multiple-math">\n${text}</pre>\n`
}

Renderer.prototype.inlineMath = function (math) {
  let output = ''
  if (this.options.mathRenderer) {
    const displayMode = false
    output = this.options.mathRenderer(math, displayMode)
  }
  return output || math
}

Renderer.prototype.code = function (code, lang, escaped, codeBlockStyle) {
  if (this.options.highlight) {
    let out = this.options.highlight(code, lang)
    if (out !== null && out !== code) {
      escaped = true
      code = out
    }
  }

  let className = codeBlockStyle === 'fenced' ? 'fenced-code-block' : 'indented-code-block'
  className = lang ? `${className} ${this.options.langPrefix}${escape(lang, true)}` : className

  return '<pre><code class="' +
    className +
    '">' +
    (escaped ? code : escape(code, true)) +
    '\n</code></pre>\n'
}

Renderer.prototype.blockquote = function (quote) {
  return '<blockquote>\n' + quote + '</blockquote>\n'
}

Renderer.prototype.html = function (html) {
  return html
}

Renderer.prototype.heading = function (text, level, raw, headingStyle) {
  return '<h' +
    level +
    ' id="' +
    this.options.headerPrefix +
    raw.toLowerCase().replace(/[^\w]+/g, '-') +
    '" class="' +
    headingStyle +
    '">' +
    text +
    '</h' +
    level +
    '>\n'
}

Renderer.prototype.hr = function () {
  return this.options.xhtml ? '<hr/>\n' : '<hr>\n'
}

Renderer.prototype.list = function (body, ordered, start, taskList) {
  const type = ordered ? 'ol' : 'ul'
  const classes = !ordered ? (taskList ? ' class="task-list"' : ' class="bullet-list"') : ' class="order-list"'
  const startatt = (ordered && start !== 1) ? (' start="' + start + '"') : ''
  return '<' + type + classes + startatt + '>\n' + body + '</' + type + '>\n'
}

Renderer.prototype.listitem = function (text, checked, listItemType, bulletListItemMarker, loose) {
  let classes
  switch (listItemType) {
    case 'order':
      classes = ' class="order-list-item'
      break
    case 'task':
      classes = ' class="task-list-item'
      break
    case 'bullet':
      classes = ' class="bullet-list-item'
      break
    default:
      throw new Error('Invalid state')
  }

  // "tight-list-item" is only used to remove <p> padding
  classes += loose ? ` loose-list-item"` : ` tight-list-item"`

  if (checked === undefined) {
    return '<li ' + classes + ' data-marker="' + bulletListItemMarker + '">' + text + '</li>\n'
  }

  return '<li ' + classes + ' data-marker="' + bulletListItemMarker + '">' +
    '<input type="checkbox" class="task-list-item-checkbox"' +
    (checked ? ' checked' : '') +
    '> ' +
    text +
    '</li>\n'
}

Renderer.prototype.paragraph = function (text) {
  return '<p>' + text + '</p>\n'
}

Renderer.prototype.table = function (header, body) {
  return '<table>\n' +
    '<thead>\n' +
    header +
    '</thead>\n' +
    '<tbody>\n' +
    body +
    '</tbody>\n' +
    '</table>\n'
}

Renderer.prototype.tablerow = function (content) {
  return '<tr>\n' + content + '</tr>\n'
}

Renderer.prototype.tablecell = function (content, flags) {
  const type = flags.header ? 'th' : 'td'
  const tag = flags.align
    ? '<' + type + ' style="text-align:' + flags.align + '">'
    : '<' + type + '>'
  return tag + content + '</' + type + '>\n'
}

// span level renderer
Renderer.prototype.strong = function (text) {
  return '<strong>' + text + '</strong>'
}

Renderer.prototype.em = function (text) {
  return '<em>' + text + '</em>'
}

Renderer.prototype.codespan = function (text) {
  return '<code>' + text + '</code>'
}

Renderer.prototype.br = function () {
  return this.options.xhtml ? '<br/>' : '<br>'
}

Renderer.prototype.del = function (text) {
  return '<del>' + text + '</del>'
}

Renderer.prototype.link = function (href, title, text) {
  if (this.options.sanitize) {
    let prot
    try {
      prot = decodeURIComponent(unescape(href))
        .replace(/[^\w:]/g, '')
        .toLowerCase()
    } catch (e) {
      return ''
    }
    if (prot.indexOf('javascript:') === 0 || prot.indexOf('vbscript:') === 0) {
      return ''
    }
  }
  let out = '<a href="' + href + '"'
  if (title) {
    out += ' title="' + title + '"'
  }
  out += '>' + text + '</a>'
  return out
}

Renderer.prototype.image = function (href, title, text) {
  let out = '<img src="' + href + '" alt="' + text + '"'
  if (title) {
    out += ' title="' + title + '"'
  }
  out += this.options.xhtml ? '/>' : '>'
  return out
}

Renderer.prototype.text = function (text) {
  return text
}

export default Renderer
