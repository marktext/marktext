// help functions
const easeInOutQuad = function (t, b, c, d) {
  t /= d / 2
  if (t < 1) return c / 2 * t * t + b
  t--
  return -c / 2 * (t * (t - 2) - 1) + b
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
