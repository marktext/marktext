import { filter } from 'fuzzaldrin'
import emojis from './emojisJson'
import { CLASS_OR_ID } from '../../config'

const emojisForSearch = {}

for (const emoji of emojis) {
  if (emoji.emoji.length > 2) continue
  const newEmoji = Object.assign({}, emoji, { search: [...emoji.aliases, ...emoji.tags].join(' ') })
  if (emojisForSearch[newEmoji.category]) {
    emojisForSearch[newEmoji.category].push(newEmoji)
  } else {
    emojisForSearch[newEmoji.category] = [ newEmoji ]
  }
}

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
  if (node && node.classList.contains(CLASS_OR_ID['AG_EMOJI_MARKED_TEXT'])) {
    return node
  }
  return false
}

class Emoji {
  constructor () {
    this.cache = new Map()
  }

  search (text) {
    const { cache } = this
    if (cache.has(text)) return cache.get(text)
    const result = {}

    Object.keys(emojisForSearch).forEach(category => {
      const list = filter(emojisForSearch[category], text, { key: 'search' })
      if (list.length) {
        result[category] = list
      }
    })
    cache.set(text, result)
    return result
  }

  destroy () {
    return this.cache.clear()
  }
}

export default Emoji
