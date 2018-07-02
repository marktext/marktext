// DOTO: Don't use Node API in editor folder, remove `path` @jocs
import axios from 'axios'
import path from 'path'
import createDOMPurify from 'dompurify'

const ID_PREFIX = 'ag-'
let id = 0
export const getUniqueId = () => `${ID_PREFIX}${id++}`

export const getLongUniqueId = () => `${getUniqueId()}-${(+new Date()).toString(32)}`

export const isMetaKey = ({ key }) => key === 'Shift' || key === 'Control' || key === 'Alt' || key === 'Meta'

export const noop = () => {}

export const identity = i => i

export const isOdd = number => Math.abs(number) % 2 === 1

export const isEven = number => Math.abs(number) % 2 === 0

export const isLengthEven = (str = '') => str.length % 2 === 0

export const snakeToCamel = name => name.replace(/_([a-z])/g, (p0, p1) => p1.toUpperCase())
/**
 *  Are two arrays have intersection
 */
export const conflict = (arr1, arr2) => {
  return !(arr1[1] < arr2[0] || arr2[1] < arr1[0])
}

export const union = ({ start: tStart, end: tEnd }, { start: lStart, end: lEnd, active }) => {
  if (!(tEnd <= lStart || lEnd <= tStart)) {
    if (lStart < tStart) {
      return {
        start: tStart,
        end: tEnd < lEnd ? tEnd : lEnd,
        active
      }
    } else {
      return {
        start: lStart,
        end: tEnd < lEnd ? tEnd : lEnd,
        active
      }
    }
  }
  return null
}

// https://github.com/jashkenas/underscore
export const throttle = (func, wait = 50) => {
  let context
  let args
  let result
  let timeout = null
  let previous = 0
  const later = () => {
    previous = Date.now()
    timeout = null
    result = func.apply(context, args)
    if (!timeout) {
      context = args = null
    }
  }

  return function () {
    const now = Date.now()
    const remaining = wait - (now - previous)

    context = this
    args = arguments
    if (remaining <= 0 || remaining > wait) {
      if (timeout) {
        clearTimeout(timeout)
        timeout = null
      }
      previous = now
      result = func.apply(context, args)
      if (!timeout) {
        context = args = null
      }
    } else if (!timeout) {
      timeout = setTimeout(later, remaining)
    }
    return result
  }
}
// simple implementation...
export const debounce = (func, wait = 50) => {
  let timer = null
  return function (...args) {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => {
      func(...args)
    }, wait)
  }
}

export const deepCopyArray = array => {
  const result = []
  const len = array.length
  let i
  for (i = 0; i < len; i++) {
    if (typeof array[i] === 'object' && array[i] !== null) {
      if (Array.isArray(array[i])) {
        result.push(deepCopyArray(array[i]))
      } else {
        result.push(deepCopy(array[i]))
      }
    } else {
      result.push(array[i])
    }
  }
  return result
}

// TODO: @jocs rewrite deepCopy
export const deepCopy = object => {
  const obj = {}
  Object.keys(object).forEach(key => {
    if (typeof object[key] === 'object' && object[key] !== null) {
      if (Array.isArray(object[key])) {
        obj[key] = deepCopyArray(object[key])
      } else {
        obj[key] = deepCopy(object[key])
      }
    } else {
      obj[key] = object[key]
    }
  })
  return obj
}

export const loadImage = async (url, detectContentType) => {
  if (detectContentType) {
    const isImage = await checkImageContentType(url)
    if (!isImage) throw new Error('not an image')
  }
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => {
      resolve(url)
    }
    image.onerror = err => {
      reject(err)
    }
    image.src = url
  })
}

export const checkImageContentType = async url => {
  try {
    const res = await axios.head(url)
    const contentType = res.headers['content-type']
    if (res.status === 200 && /^image\/(?:jpeg|png|gif|svg\+xml|webp)$/.test(contentType)) {
      return true
    }
    return false
  } catch (err) {
    return false
  }
}

export const collectImportantComments = css => {
  const once = new Set()
  const cleaned = css.replace(/(\/\*![\s\S]*?\*\/)\n*/gm, (match, p1) => {
    once.add(p1)
    return ''
  })
  const combined = Array.from(once)
  combined.push(cleaned)
  return combined.join('\n')
}

export const getImageInfo = src => {
  const EXT_REG = /\.(jpeg|jpg|png|gif|svg|webp)(?=\?|$)/i
  // http[s] (domain or IPv4 or localhost or IPv6) [port] /not-white-space
  const URL_REG = /^http(s)?:\/\/([a-z0-9\-._~]+\.[a-z]{2,}|[0-9.]+|localhost|\[[a-f0-9.:]+\])(:[0-9]{1,5})?\/[\S]+/i
  const imageExtension = EXT_REG.test(src)
  const isUrl = URL_REG.test(src)
  if (imageExtension) {
    if (isUrl || !window.DIRNAME) {
      return {
        isUnknownType: false,
        src
      }
    } else {
      return {
        isUnknownType: false,
        src: 'file://' + path.resolve(window.DIRNAME, src)
      }
    }
  } else if (isUrl && !imageExtension) {
    return {
      isUnknownType: true,
      src
    }
  }
  return {
    isUnknownType: false,
    src: ''
  }
}

export const escapeHtml = html => {
  return html
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export const unescapeHtml = text => {
  return text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, `'`)
}

export const escapeInBlockHtml = html => {
  return html
    .replace(/(<(style|script|title)[^<>]*>)([\s\S]*?)(<\/\2>)/g, (m, p1, p2, p3, p4) => {
      return `${escapeHtml(p1)}${p3}${escapeHtml(p4)}`
    })
}

export const wordCount = markdown => {
  const paragraph = markdown.split(/\n{2,}/).filter(line => line).length
  let word = 0
  let character = 0
  let all = 0

  const removedChinese = markdown.replace(/[\u4e00-\u9fa5]/g, '')
  const tokens = removedChinese.split(/[\s\n]+/).filter(t => t)
  const chineseWordLength = markdown.length - removedChinese.length
  word += chineseWordLength + tokens.length
  character += tokens.reduce((acc, t) => acc + t.length, 0) + chineseWordLength
  all += markdown.length

  return { word, paragraph, character, all }
}

/**
 * [genUpper2LowerKeyHash generate constants map hash, the value is lowercase of the key,
 * also translate `_` to `-`]
 */
export const genUpper2LowerKeyHash = keys => {
  return keys.reduce((acc, key) => {
    const value = key.toLowerCase().replace(/_/g, '-')
    return Object.assign(acc, { [key]: value })
  }, {})
}

/**
 * generate constants map, the value is the key.
 */
export const generateKeyHash = keys => {
  return keys.reduce((acc, key) => {
    return Object.assign(acc, { [key]: key })
  }, {})
}

// mixins
export const mixins = (constructor, ...object) => {
  return Object.assign(constructor.prototype, ...object)
}

export const sanitize = (html, options) => {
  const DOMPurify = createDOMPurify(window)
  return DOMPurify.sanitize(escapeInBlockHtml(html), options)
}
