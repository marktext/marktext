import crypto from 'crypto'

// help functions
const easeInOutQuad = function (t, b, c, d) {
  t /= d / 2
  if (t < 1) return c / 2 * t * t + b
  t--
  return -c / 2 * (t * (t - 2) - 1) + b
}

const ID_PREFEX = 'mt-'
let id = 0
const DOTU = 'DOTU'
const MAX_HISTORY_LENGTH = 10
const DOTU_COLLECTION = 'DOTU_COLLECTION'
const deleteItem = key => value => {
  const data = localStorage.getItem(key)
  if (!data) return
  const col = JSON.parse(data)
  const index = col.indexOf(value)
  if (index > -1) {
    col.splice(index, 1)
    localStorage.setItem(key, JSON.stringify(col))
  }
}

export const serialize = function (params) {
  return Object.keys(params).map(key => `${key}=${encodeURI(params[key])}`).join('&')
}

export const merge = function (...args) {
  return Object.assign({}, ...args)
}

export const dataURItoBlob = function (dataURI) {
  const data = dataURI.split(';base64,')
  const byte = window.atob(data[1])
  const mime = data[0].split(':')[1]
  const ab = new ArrayBuffer(byte.length)
  const ia = new Uint8Array(ab)
  const len = byte.length
  let i
  for (i = 0; i < len; i++) {
    ia[i] = byte.charCodeAt(i)
  }
  return new window.Blob([ab], { type: mime })
}

export const collection = {
  setItem (emoji) {
    const data = localStorage.getItem(DOTU_COLLECTION)
    if (data) {
      const col = JSON.parse(data)
      if (col.findIndex(c => c.link === emoji.link) === -1) {
        col.push(emoji)
      }
      localStorage.setItem(DOTU_COLLECTION, JSON.stringify(col))
    } else {
      localStorage.setItem(DOTU_COLLECTION, JSON.stringify([emoji]))
    }
  },
  getItems () {
    const data = localStorage.getItem(DOTU_COLLECTION)
    return data ? JSON.parse(data) : []
  },
  deleteItem (emoji) {
    const data = localStorage.getItem(DOTU_COLLECTION)
    if (!data) return
    const col = JSON.parse(data)
    const index = col.findIndex(c => c.link === emoji.link)
    if (index > -1) {
      col.splice(index, 1)
      localStorage.setItem(DOTU_COLLECTION, JSON.stringify(col))
    }
  }
}

export const dotuHistory = {
  setItem (value) {
    const data = localStorage.getItem(DOTU)
    if (data) {
      let history = JSON.parse(data)
      history.unshift(value)
      history = [...new Set(history)] // delete the duplicate word
      if (history.length > MAX_HISTORY_LENGTH) {
        history.pop()
      }
      localStorage.setItem(DOTU, JSON.stringify(history))
    } else {
      localStorage.setItem(DOTU, JSON.stringify([value]))
    }
  },
  getItems () {
    const data = localStorage.getItem(DOTU)
    return data ? JSON.parse(data) : []
  },
  deleteItem: deleteItem(DOTU),
  clear () {
    localStorage.setItem(DOTU, '[]')
  }
}

export const adjustCursor = (cursor, preline, line, nextline) => {
  let newCursor = Object.assign({}, { line: cursor.line, ch: cursor.ch })
  // It's need to adjust the cursor when cursor is at begin or end in table row.
  if (/\|[^|]+\|.+\|\s*$/.test(line)) {
    if (/\|\s*:?-+:?\s*\|[:-\s|]+\|\s*$/.test(line)) { // cursor in `| --- | :---: |` :the second line of table
      newCursor.line += 1 // reset the cursor to the next line
      newCursor.ch = nextline.indexOf('|') + 1
    } else { // cursor is not at the second line to table
      if (cursor.ch <= line.indexOf('|')) newCursor.ch = line.indexOf('|') + 1
      if (cursor.ch >= line.lastIndexOf('|')) newCursor.ch = line.lastIndexOf('|') - 1
    }
  }

  // Need to adjust the cursor when cursor in the first or last line of code/math block.
  if (/```[\S]*/.test(line) || /^\$\$$/.test(line)) {
    if (typeof nextline === 'string' && /\S/.test(nextline)) {
      newCursor.line += 1
      newCursor.ch = 0
    } else if (typeof preline === 'string' && /\S/.test(preline)) {
      newCursor.line -= 1
      newCursor.ch = preline.length
    }
  }

  // Need to adjust the cursor when cursor at the begin of the list
  if (/[*+-]\s.+/.test(line) && newCursor.ch <= 1) {
    newCursor.ch = 2
  }
  // Need to adjust the cursor when cursor at blank line or in a line contains HTML tag.
  // set the newCursor to null, the new cursor will at the last line of document.
  if (!/\S/.test(line) || /<\/?([a-zA-Z\d-]+)(?=\s|>).*>/.test(line)) {
    newCursor = null
  }

  return newCursor
}

export const animatedScrollTo = function (element, to, duration, callback) {
  const start = element.scrollTop
  const change = to - start
  const animationStart = +new Date()
  let animating = true
  let lastpos = null

  const animateScroll = function () {
    if (!animating) {
      return
    }
    requestAnimationFrame(animateScroll)
    const now = +new Date()
    const val = Math.floor(easeInOutQuad(now - animationStart, start, change, duration))
    if (lastpos) {
      if (lastpos === element.scrollTop) {
        lastpos = val
        element.scrollTop = val
      } else {
        animating = false
      }
    } else {
      lastpos = val
      element.scrollTop = val
    }
    if (now > animationStart + duration) {
      element.scrollTop = to
      animating = false
      if (callback) {
        callback()
      }
    }
  }
  requestAnimationFrame(animateScroll)
}

export const getUniqueId = () => {
  return `${ID_PREFEX}${id++}`
}

export const hasKeys = obj => Object.keys(obj).length > 0

/**
 * Clone an object as a shallow or deep copy.
 *
 * @param {*} obj Object to clone
 * @param {Boolean} deepCopy Create a shallow (false) or deep copy (true)
 */
export const cloneObj = (obj, deepCopy = true) => {
  return deepCopy ? JSON.parse(JSON.stringify(obj)) : Object.assign({}, obj)
}

export const getHash = (content, encoding, type) => {
  return crypto.createHash(type).update(content, encoding).digest('hex')
}

export const getContentHash = content => {
  return getHash(content, 'utf8', 'sha1')
}

export const isOsx = process.platform === 'darwin'
export const isWindows = process.platform === 'win32'
export const isLinux = process.platform === 'linux'
