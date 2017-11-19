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

export const throttle = fn => {
  let timer = null
  return (...args) => {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => {
      fn(...args)
    }, 300)
  }
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
