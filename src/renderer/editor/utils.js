/**
 * RegExp constants
 */
const HEAD_REG = /^(#{1,6})(.+)$/
const EMPHASIZE_REG_G = /(\*{1,3})(.*)(\1)/g
const EMPHASIZE_REG = /(\*{1,3})(.*)(\1)/
const LINE_BREAK_BLOCK_REG = /^(?:#{1,6}|>\s|`{3,}(.*))/
const INLINE_BLOCK_REG = /^(?:[*+-]\s(\[\s\]\s)?|\d+\.\s)/

/**
 * help functions
 */
const conflict = (arr1, arr2) => {
  // Are two array have intersection
  return !(arr1[1] < arr2[0] || arr2[1] < arr1[0])
}
const getId = () => {
  const prefix = 'ag-'
  return `${prefix}${Math.random().toString(32).slice(2)}`
}
/**
 * get unique id name
 */
const getUniqueId = set => {
  let id = getId()
  while (set.has(id)) {
    id = getId()
  }
  set.add(id)
  return { set, id }
}

/**
 * markedText to html
 */
const markedText2Html = (markedText, cursorRange) => {
  let result = ''
  // handle head mark symble
  if (HEAD_REG.test(markedText)) {
    result = markedText.replace(HEAD_REG, '<span class="gray">$1</span>$2')
  }
  // handle emphasize
  if (EMPHASIZE_REG.test(markedText)) {
    const offset = markedText.match(EMPHASIZE_REG).index
    result = result.replace(EMPHASIZE_REG_G, (match, p1, p2, p3) => {
      const isConflicted = conflict([offset, offset + match.length], cursorRange)
      const className = isConflicted ? 'gray' : 'hidden'
      const tags = { startTags: '', endTags: '' }
      switch (p1.length) {
        case 1:
          tags.startTags = '<em>'
          tags.endTags = '</em>'
          break
        case 2:
          tags.startTags = '<strong>'
          tags.endTags = '</strong>'
          break
        case 3:
          tags.startTags = '<strong><em>'
          tags.endTags = '</em></strong>'
      }
      const { startTags, endTags } = tags
      return `<span class="${className}">${p1}</span>${startTags}${p2}${endTags}<span class="${className}">${p2}</span>`
    })
  }
  // handle link
  // TODO
  // handle picture
  // TODO
  // handle code
  // TODO
  // handle auto link
  // TODO
  return result
}
/**
 * checkInlineUpdate
 */

const checkInlineUpdate = text => {
  const token = text.match(INLINE_BLOCK_REG)
  if (!token) return false
  const match = token[0]
  switch (true) {
    case /[*+-]\s/.test(match):
      return token[1] ? { type: 'ul', info: 'tasklist' } : { type: 'ul', info: 'disorder' }
    case /\d+\.\s/.test(match):
      return { type: 'ol' }
    default:
      return false
  }
}

const checkLineBreakUpdate = text => {
  const token = text.match(LINE_BREAK_BLOCK_REG)
  if (!token) return false
  const match = token[0]
  switch (true) {
    case /#{1,6}/.test(match):
      return { type: `h${match.length + 1}` }
    case />\s/.test(match):
      return { type: 'blockquote' }
    case /`{3,}.*/.test(match):
      return { type: 'blockcode', info: token[1] }
    default:
      return false
  }
}

/**
 * translate paragraph to ohter block
 */

/**
 * viewModel2Html
 */

export {
  getUniqueId,
  markedText2Html,
  checkInlineUpdate,
  checkLineBreakUpdate
}
