import { filter } from 'fuzzaldrin'
import emojis from './emojisJson'
import { CLASS_OR_ID } from '../config'

const emojisForSearch = emojis.map(emoji => {
  return Object.assign({}, emoji, { search: [...emoji.aliases, ...emoji.tags].join(' ') })
})

/**
 * check if one emoji code is in emojis, return undefined or found emoji
 */
export const validEmoji = text => {
  return emojis.find(emoji => {
    return emoji.aliases.includes(text)
  })
}

/**
 * check edit emoji
 */

export const checkEditEmoji = node => {
  const preSibling = node.previousElementSibling
  if (node.classList.contains(CLASS_OR_ID['AG_EMOJI_MARKED_TEXT'])) {
    return node
  } else if (preSibling && preSibling.classList.contains(CLASS_OR_ID['AG_EMOJI_MARKED_TEXT'])) {
    return preSibling
  }
  return false
}

export const setInlineEmoji = (node, emoji, selection) => {
  node.textContent = `${emoji.text}`
  node.setAttribute('data-emoji', emoji.emoji)
  selection.moveCursor(node.nextElementSibling, 1)
}

class Emoji {
  constructor () {
    this.cache = new Map()
  }

  search (text) {
    const { cache } = this

    if (cache.has(text)) return cache.get(text)

    const result = filter(emojisForSearch, text, { key: 'search' })
    cache.set(text, result)
    return result
  }

  clear () {
    return this.cache.clear()
  }

  checkValidation (text) {
    validEmoji(text)
  }
}

export default Emoji
