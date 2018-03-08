// help functions
const easeInOutQuad = function (t, b, c, d) {
  t /= d / 2
  if (t < 1) return c / 2 * t * t + b
  t--
  return -c / 2 * (t * (t - 2) - 1) + b
}

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
  return Object.keys(params).map(key => `${key}=${params[key]}`).join('&')
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
      let col = JSON.parse(data)
      if (col.findIndex(c => c.link === emoji.link) === -1) {
        col.push(emoji)
      }
      localStorage.setItem(DOTU_COLLECTION, JSON.stringify(col))
    } else {
      localStorage.setItem(DOTU_COLLECTION, JSON.stringify([ emoji ]))
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
      localStorage.setItem(DOTU, JSON.stringify([ value ]))
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

export const animatedScrollTo = function (element, to, duration, callback) {
  let start = element.scrollTop
  let change = to - start
  let animationStart = +new Date()
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
