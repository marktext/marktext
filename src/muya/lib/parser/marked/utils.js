/**
 * Helpers
 */

export const escape = function escape (html, encode) {
  if (encode) {
    if (escape.escapeTest.test(html)) {
      return html.replace(escape.escapeReplace, function (ch) { return escape.replacements[ch] })
    }
  } else {
    if (escape.escapeTestNoEncode.test(html)) {
      return html.replace(escape.escapeReplaceNoEncode, function (ch) { return escape.replacements[ch] })
    }
  }

  return html
}

escape.escapeTest = /[&<>"']/
escape.escapeReplace = /[&<>"']/g
escape.replacements = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
}

escape.escapeTestNoEncode = /[<>"']|&(?!#?\w+;)/
escape.escapeReplaceNoEncode = /[<>"']|&(?!#?\w+;)/g

export const unescape = function unescape (html) {
  // explicitly match decimal, hex, and named HTML entities
  return html.replace(/&(#(?:\d+)|(?:#x[0-9A-Fa-f]+)|(?:\w+));?/ig, function (_, n) {
    n = n.toLowerCase()
    if (n === 'colon') return ':'
    if (n.charAt(0) === '#') {
      return n.charAt(1) === 'x'
        ? String.fromCharCode(parseInt(n.substring(2), 16))
        : String.fromCharCode(+n.substring(1))
    }
    return ''
  })
}

export const edit = function edit (regex, opt) {
  regex = regex.source || regex
  opt = opt || ''
  return {
    replace: function (name, val) {
      val = val.source || val
      val = val.replace(/(^|[^\[])\^/g, '$1') // eslint-disable-line no-useless-escape
      regex = regex.replace(name, val)
      return this
    },
    getRegex: function () {
      return new RegExp(regex, opt)
    }
  }
}

export const cleanUrl = function cleanUrl (sanitize, base, href) {
  if (sanitize) {
    let prot = ''
    try {
      prot = decodeURIComponent(unescape(href))
        .replace(/[^\w:]/g, '')
        .toLowerCase()
    } catch (e) {
      return null
    }
    if (prot.indexOf('javascript:') === 0 || prot.indexOf('vbscript:') === 0 || prot.indexOf('data:') === 0) {
      return null
    }
  }
  if (base && !originIndependentUrl.test(href)) {
    href = resolveUrl(base, href)
  }
  try {
    href = encodeURI(href).replace(/%25/g, '%')
  } catch (e) {
    return null
  }
  return href
}

const resolveUrl = function resolveUrl (base, href) {
  if (!baseUrls[' ' + base]) {
    // we can ignore everything in base after the last slash of its path component,
    // but we might need to add _that_
    // https://tools.ietf.org/html/rfc3986#section-3
    if (/^[^:]+:\/*[^/]*$/.test(base)) {
      baseUrls[' ' + base] = base + '/'
    } else {
      baseUrls[' ' + base] = rtrim(base, '/', true)
    }
  }
  base = baseUrls[' ' + base]

  if (href.slice(0, 2) === '//') {
    return base.replace(/:[\s\S]*/, ':') + href
  } else if (href.charAt(0) === '/') {
    return base.replace(/(:\/*[^/]*)[\s\S]*/, '$1') + href
  } else {
    return base + href
  }
}
const baseUrls = {}
const originIndependentUrl = /^$|^[a-z][a-z0-9+.-]*:|^[?#]/i

export const noop = function noop () {}
noop.exec = noop

export const splitCells = function splitCells (tableRow, count) {
  // ensure that every cell-delimiting pipe has a space
  // before it to distinguish it from an escaped pipe
  const row = tableRow.replace(/\|/g, function (match, offset, str) {
    let escaped = false
    let curr = offset
    while (--curr >= 0 && str[curr] === '\\') escaped = !escaped
    if (escaped) {
      // odd number of slashes means | is escaped
      // so we leave it alone
      return '|'
    } else {
      // add space before unescaped |
      return ' |'
    }
  })
  const cells = row.split(/ \|/)
  let i = 0

  if (cells.length > count) {
    cells.splice(count)
  } else {
    while (cells.length < count) cells.push('')
  }

  for (; i < cells.length; i++) {
    // leading or trailing whitespace is ignored per the gfm spec
    cells[i] = cells[i].trim().replace(/\\\|/g, '|')
  }
  return cells
}

// Remove trailing 'c's. Equivalent to str.replace(/c*$/, '').
// /c*$/ is vulnerable to REDOS.
// invert: Remove suffix of non-c chars instead. Default falsey.
export const rtrim = function rtrim (str, c, invert) {
  if (str.length === 0) {
    return ''
  }

  // Length of suffix matching the invert condition.
  let suffLen = 0

  // Step left until we fail to match the invert condition.
  while (suffLen < str.length) {
    const currChar = str.charAt(str.length - suffLen - 1)
    if (currChar === c && !invert) {
      suffLen++
    } else if (currChar !== c && invert) {
      suffLen++
    } else {
      break
    }
  }

  return str.substr(0, str.length - suffLen)
}

export const findClosingBracket = function findClosingBracket (str, b) {
  if (str.indexOf(b[1]) === -1) {
    return -1
  }
  let level = 0
  for (let i = 0; i < str.length; i++) {
    if (str[i] === '\\') {
      i++
    } else if (str[i] === b[0]) {
      level++
    } else if (str[i] === b[1]) {
      level--
      if (level < 0) {
        return i
      }
    }
  }
  return -1
}
