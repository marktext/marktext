import Renderer from './renderer'
import { normal, breaks, gfm, pedantic } from './inlineRules'
import defaultOptions from './options'
import { escape, findClosingBracket, getUniqueId, rtrim } from './utils'
import { validateEmphasize, lowerPriority } from '../utils'

/**
 * Inline Lexer & Compiler
 */

function InlineLexer (links, footnotes, options) {
  this.options = options || defaultOptions
  this.links = links
  this.footnotes = footnotes
  this.rules = normal
  this.renderer = this.options.renderer || new Renderer()
  this.renderer.options = this.options

  if (!this.links) {
    throw new Error('Tokens array requires a `links` property.')
  }

  if (this.options.pedantic) {
    this.rules = pedantic
  } else if (this.options.gfm) {
    if (this.options.breaks) {
      this.rules = breaks
    } else {
      this.rules = gfm
    }
  }
  this.highPriorityEmpRules = {}
  this.highPriorityLinkRules = {}
  for (const key of Object.keys(this.rules)) {
    if (/^(?:autolink|link|code|tag)$/.test(key) && this.rules[key] instanceof RegExp) {
      this.highPriorityEmpRules[key] = this.rules[key]
    }
  }
  for (const key of Object.keys(this.rules)) {
    if (/^(?:autolink|code|tag)$/.test(key) && this.rules[key] instanceof RegExp) {
      this.highPriorityLinkRules[key] = this.rules[key]
    }
  }
}

/**
 * Lexing/Compiling
 */

InlineLexer.prototype.output = function (src) {
  // src = src
  // .replace(/\u00a0/g, ' ')
  const { disableInline, emoji, math, superSubScript, footnote } = this.options
  if (disableInline) {
    return escape(src)
  }

  let out = ''
  let link
  let text
  let href
  let title
  let cap
  let prevCapZero
  let lastChar = ''

  while (src) {
    // escape
    cap = this.rules.escape.exec(src)
    if (cap) {
      src = src.substring(cap[0].length)
      lastChar = cap[0].charAt(cap[0].length - 1)
      out += escape(cap[1])
      continue
    }

    // footnote identifier
    if (footnote) {
      cap = this.rules.footnoteIdentifier.exec(src)
      if (cap) {
        src = src.substring(cap[0].length)
        lastChar = cap[0].charAt(cap[0].length - 1)
        const identifier = cap[1]

        const footnoteInfo = this.footnotes[identifier] || {}
        if (footnoteInfo.footnoteIdentifierId === undefined) {
          footnoteInfo.footnoteIdentifierId = getUniqueId()
        }

        out += this.renderer.footnoteIdentifier(identifier, footnoteInfo)
      }
    }

    // tag
    cap = this.rules.tag.exec(src)
    if (cap) {
      if (!this.inLink && /^<a /i.test(cap[0])) {
        this.inLink = true
      } else if (this.inLink && /^<\/a>/i.test(cap[0])) {
        this.inLink = false
      }
      if (!this.inRawBlock && /^<(pre|code|kbd|script)(\s|>)/i.test(cap[0])) {
        this.inRawBlock = true
      } else if (this.inRawBlock && /^<\/(pre|code|kbd|script)(\s|>)/i.test(cap[0])) {
        this.inRawBlock = false
      }

      src = src.substring(cap[0].length)
      lastChar = cap[0].charAt(cap[0].length - 1)
      out += this.renderer.html(this.options.sanitize
        ? (this.options.sanitizer
          ? this.options.sanitizer(cap[0])
          : escape(cap[0]))
        : cap[0])
      continue
    }

    // link
    cap = this.rules.link.exec(src)
    if (cap && lowerPriority(src, cap[0].length, this.highPriorityLinkRules)) {
      const trimmedUrl = cap[2].trim()
      if (!this.options.pedantic && trimmedUrl.startsWith('<')) {
        // commonmark requires matching angle brackets
        if (!trimmedUrl.endsWith('>')) {
          return
        }

        // ending angle bracket cannot be escaped
        const rtrimSlash = rtrim(trimmedUrl.slice(0, -1), '\\')
        if ((trimmedUrl.length - rtrimSlash.length) % 2 === 0) {
          return
        }
      } else {
        // find closing parenthesis
        const lastParenIndex = findClosingBracket(cap[2], '()')
        if (lastParenIndex > -1) {
          const start = cap[0].indexOf('!') === 0 ? 5 : 4
          const linkLen = start + cap[1].length + lastParenIndex
          cap[2] = cap[2].substring(0, lastParenIndex)
          cap[0] = cap[0].substring(0, linkLen).trim()
          cap[3] = ''
        }
      }
      src = src.substring(cap[0].length)
      lastChar = cap[0].charAt(cap[0].length - 1)
      href = cap[2]
      if (this.options.pedantic) {
        // split pedantic href and title
        link = /^([^'"]*[^\s])\s+(['"])(.*)\2/.exec(href)

        if (link) {
          href = link[1]
          title = link[3]
        }
      } else {
        title = cap[3] ? cap[3].slice(1, -1) : ''
      }
      href = href.trim()
      if (href.startsWith('<')) {
        if (this.options.pedantic && !trimmedUrl.endsWith('>')) {
          // pedantic allows starting angle bracket without ending angle bracket
          href = href.slice(1)
        } else {
          href = href.slice(1, -1)
        }
      }

      this.inLink = true
      out += this.outputLink(cap, {
        href: this.escapes(href),
        title: this.escapes(title)
      })
      this.inLink = false
      continue
    }

    // reflink, nolink
    cap = this.rules.reflink.exec(src) || this.rules.nolink.exec(src)
    if (cap) {
      src = src.substring(cap[0].length)
      lastChar = cap[0].charAt(cap[0].length - 1)
      link = (cap[2] || cap[1]).replace(/\s+/g, ' ')
      link = this.links[link.toLowerCase()]
      if (!link || !link.href) {
        out += cap[0].charAt(0)
        src = cap[0].substring(1) + src
        continue
      }
      this.inLink = true
      out += this.outputLink(cap, link)
      this.inLink = false
      continue
    }

    // math
    if (math) {
      cap = this.rules.math.exec(src)
      if (cap) {
        src = src.substring(cap[0].length)
        lastChar = cap[0].charAt(cap[0].length - 1)
        text = cap[1]
        out += this.renderer.inlineMath(text)
      }
    }

    // emoji
    if (emoji) {
      cap = this.rules.emoji.exec(src)
      if (cap) {
        src = src.substring(cap[0].length)
        lastChar = cap[0].charAt(cap[0].length - 1)
        text = cap[0]
        out += this.renderer.emoji(text, cap[2])
      }
    }

    // superSubScript
    if (superSubScript) {
      cap = this.rules.superscript.exec(src) || this.rules.subscript.exec(src)
      if (cap) {
        src = src.substring(cap[0].length)
        lastChar = cap[0].charAt(cap[0].length - 1)
        const content = cap[2]
        const marker = cap[1]
        out += this.renderer.script(content, marker)
      }
    }

    // strong
    cap = this.rules.strong.exec(src)
    if (cap) {
      const marker = cap[0].match(/^(?:_{1,2}|\*{1,2})/)[0]
      const isValid = validateEmphasize(src, cap[0].length, marker, lastChar, this.highPriorityEmpRules)
      if (isValid) {
        src = src.substring(cap[0].length)
        lastChar = cap[0].charAt(cap[0].length - 1)
        out += this.renderer.strong(this.output(cap[4] || cap[3] || cap[2] || cap[1]))
        continue
      }
    }

    // em
    cap = this.rules.em.exec(src)
    if (cap) {
      const marker = cap[0].match(/^(?:_{1,2}|\*{1,2})/)[0]
      const isValid = validateEmphasize(src, cap[0].length, marker, lastChar, this.highPriorityEmpRules)
      if (isValid) {
        src = src.substring(cap[0].length)
        lastChar = cap[0].charAt(cap[0].length - 1)
        out += this.renderer.em(this.output(cap[6] || cap[5] || cap[4] || cap[3] || cap[2] || cap[1]))
        continue
      }
    }

    // code
    cap = this.rules.code.exec(src)
    if (cap) {
      src = src.substring(cap[0].length)
      lastChar = cap[0].charAt(cap[0].length - 1)

      let text = cap[2].replace(/\n/g, ' ')
      const hasNonSpaceChars = /[^ ]/.test(text)
      const hasSpaceCharsOnBothEnds = text.startsWith(' ') && text.endsWith(' ')
      if (hasNonSpaceChars && hasSpaceCharsOnBothEnds) {
        text = text.substring(1, text.length - 1)
      }
      text = escape(text, true)
      out += this.renderer.codespan(text)
      continue
    }

    // br
    cap = this.rules.br.exec(src)
    if (cap) {
      src = src.substring(cap[0].length)
      lastChar = cap[0].charAt(cap[0].length - 1)
      out += this.renderer.br()
      continue
    }

    // del (gfm)
    cap = this.rules.del.exec(src)
    if (cap) {
      src = src.substring(cap[0].length)
      lastChar = cap[0].charAt(cap[0].length - 1)
      out += this.renderer.del(this.output(cap[2]))
      continue
    }

    // autolink
    cap = this.rules.autolink.exec(src)
    if (cap) {
      src = src.substring(cap[0].length)
      lastChar = cap[0].charAt(cap[0].length - 1)
      if (cap[2] === '@') {
        text = escape(this.mangle(cap[1]))
        href = 'mailto:' + text
      } else {
        text = escape(cap[1])
        href = text
      }
      out += this.renderer.link(href, null, text)
      continue
    }

    // url (gfm)
    cap = this.rules.url.exec(src)
    if (!this.inLink && cap) {
      if (cap[2] === '@') {
        text = escape(cap[0])
        href = 'mailto:' + text
      } else {
        // do extended autolink path validation
        do {
          prevCapZero = cap[0]
          cap[0] = this.rules._backpedal.exec(cap[0])[0]
        } while (prevCapZero !== cap[0])
        text = escape(cap[0])
        if (cap[1] === 'www.') {
          href = 'http://' + text
        } else {
          href = text
        }
      }
      src = src.substring(cap[0].length)
      lastChar = cap[0].charAt(cap[0].length - 1)
      out += this.renderer.link(href, null, text)
      continue
    }

    // text
    cap = this.rules.text.exec(src)
    if (cap) {
      src = src.substring(cap[0].length)
      lastChar = cap[0].charAt(cap[0].length - 1)
      if (this.inRawBlock) {
        out += this.renderer.text(this.options.sanitize ? (this.options.sanitizer ? this.options.sanitizer(cap[0]) : escape(cap[0])) : cap[0])
      } else {
        out += this.renderer.text(escape(this.smartypants(cap[0])))
      }
      continue
    }

    if (src) {
      throw new Error('Infinite loop on byte: ' + src.charCodeAt(0))
    }
  }

  return out
}

InlineLexer.prototype.escapes = function (text) {
  return text ? text.replace(this.rules._escapes, '$1') : text
}

/**
 * Compile Link
 */

InlineLexer.prototype.outputLink = function (cap, link) {
  const href = link.href
  const title = link.title ? escape(link.title) : null
  const text = cap[1].replace(/\\([\[\]])/g, '$1') // eslint-disable-line no-useless-escape

  return cap[0].charAt(0) !== '!'
    ? this.renderer.link(href, title, this.output(text))
    : this.renderer.image(href, title, escape(text))
}

/**
 * Smartypants Transformations
 */

InlineLexer.prototype.smartypants = function (text) {
  /* eslint-disable no-useless-escape */
  if (!this.options.smartypants) return text
  return text
    // em-dashes
    .replace(/---/g, '\u2014')
    // en-dashes
    .replace(/--/g, '\u2013')
    // opening singles
    .replace(/(^|[-\u2014/(\[{"\s])'/g, '$1\u2018')
    // closing singles & apostrophes
    .replace(/'/g, '\u2019')
    // opening doubles
    .replace(/(^|[-\u2014/(\[{\u2018\s])"/g, '$1\u201c')
    // closing doubles
    .replace(/"/g, '\u201d')
    // ellipses
    .replace(/\.{3}/g, '\u2026')
  /* eslint-ensable no-useless-escape */
}

/**
 * Mangle Links
 */

InlineLexer.prototype.mangle = function (text) {
  if (!this.options.mangle) return text
  const l = text.length
  let out = ''
  let ch

  for (let i = 0; i < l; i++) {
    ch = text.charCodeAt(i)
    if (Math.random() > 0.5) {
      ch = 'x' + ch.toString(16)
    }
    out += '&#' + ch + ';'
  }

  return out
}

export default InlineLexer
