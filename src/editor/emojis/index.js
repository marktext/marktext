import emojis from './emojisJson'
import EmojiBox from './emojiFloatBox'

/**
 * check one imoji code is in emojis, return undefined or found emoji
 */
export const validEmoji = text => {
  return emojis.filter(emoji => {
    return emoji.aliases.includes(text)
  })[0]
}

class Emoji {
  constructor (event) {
    this.cache = new Map()
    this.box = new EmojiBox(event)
  }

  search (text) {
    const { cache } = this

    if (cache.has(text)) return cache.get(text)

    const SEARCH_REG = new RegExp(`^${text}`, 'i')
    const result = emojis.filter(emoji => {
      return [...emoji.aliases, ...emoji.tags].some(name => {
        return SEARCH_REG.test(name)
      })
    })
    cache.set(text, result)
    return result
  }

  clear () {
    return this.cache.clear()
  }

  checkvalidation (text) {
    validEmoji(text)
  }
}

export default Emoji
