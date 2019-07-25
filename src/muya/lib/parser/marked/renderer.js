import defaultOptions from './options'
import { cleanUrl, escape } from './utils'

/**
 * Renderer
 */

function Renderer (options = {}) {
  this.options = options || defaultOptions
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

Renderer.prototype.emoji = function (text, emoji) {
  if (this.options.emojiRenderer) {
    return this.options.emojiRenderer(emoji)
  } else {
    return text
  }
}

Renderer.prototype.code = function (code, infostring, escaped, codeBlockStyle) {
  const lang = (infostring || '').match(/\S*/)[0]
  if (this.options.highlight) {
    const out = this.options.highlight(code, lang)
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

Renderer.prototype.heading = function (text, level, raw, slugger, headingStyle) {
  if (this.options.headerIds) {
    return '<h' +
      level +
      ' id="' +
      this.options.headerPrefix +
      slugger.slug(raw) +
      '" class="' +
      headingStyle +
      '">' +
      text +
      '</h' +
      level +
      '>\n'
  }
  // ignore IDs
  return '<h' + level + '>' + text + '</h' + level + '>\n'
}

Renderer.prototype.hr = function () {
  return this.options.xhtml ? '<hr/>\n' : '<hr>\n'
}

Renderer.prototype.list = function (body, ordered, start, taskList) {
  const type = ordered ? 'ol' : 'ul'
  const startatt = (ordered && start !== 1) ? (' start="' + start + '"') : ''
  return '<' + type + startatt + '>\n' + body + '</' + type + '>\n'
}

Renderer.prototype.listitem = function (text, checked) {
  // normal list
  if (checked === undefined) {
    return '<li>' + text + '</li>\n'
  }

  // task list
  return '<li class="task-list-item"><input type="checkbox"' +
    (checked ? ' checked=""' : '') +
    ' disabled=""' +
    (this.options.xhtml ? ' /' : '') +
    '> ' +
    text +
    '</li>\n'
}

Renderer.prototype.paragraph = function (text) {
  return '<p>' + text + '</p>\n'
}

Renderer.prototype.table = function (header, body) {
  if (body) body = '<tbody>' + body + '</tbody>'

  return '<table>\n' +
    '<thead>\n' +
    header +
    '</thead>\n' +
    body +
    '</table>\n'
}

Renderer.prototype.tablerow = function (content) {
  return '<tr>\n' + content + '</tr>\n'
}

Renderer.prototype.tablecell = function (content, flags) {
  const type = flags.header ? 'th' : 'td'
  const tag = flags.align
    ? '<' + type + ' align="' + flags.align + '">'
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
  href = cleanUrl(this.options.sanitize, this.options.baseUrl, href)
  if (href === null) {
    return text
  }
  let out = '<a href="' + escape(href) + '"'
  if (title) {
    out += ' title="' + title + '"'
  }
  out += '>' + text + '</a>'
  return out
}

Renderer.prototype.image = function (href, title, text) {
  href = cleanUrl(this.options.sanitize, this.options.baseUrl, href)
  if (href === null) {
    return text
  }

  let out = '<img src="' + href + '" alt="' + text.replace(/\*/g, '') + '"'
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
