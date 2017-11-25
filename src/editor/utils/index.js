// help functions
const getId = () => {
  const prefix = 'ag-'

  return `${prefix}${Math.random().toString(32).slice(2)}`
}

/**
 * get unique id base on a set.
 */
export const getUniqueId = set => {
  let id

  do {
    id = getId()
  } while (set.has(id))
  set.add(id)

  return id
}

export const isOdd = number => Math.abs(number) % 2 === 1
export const isEven = number => Math.abs(number) % 2 === 0

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

export const loadImage = url => {
  const image = new Image()
  return new Promise((resolve, reject) => {
    image.onload = () => {
      resolve(url)
    }
    image.onerror = err => {
      reject(err)
    }
    image.src = url
  })
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
