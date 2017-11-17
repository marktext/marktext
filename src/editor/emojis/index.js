import emojis from './emojisJson'
import EmojiBox from './emojiFloatBox'

class Emoji {
  constructor (event) {
    this.cache = new Map()
    this.box = new EmojiBox(event)
  }

  search (text) {
    const { cache } = this

    if (cache.has(text)) return cache.get(text)

    const SEARCH_REG = new RegExp(text, 'i')
    const result = emojis.filter(emoji => {
      const targetStr = [...emoji.aliases, ...emoji.tags].join(/\s/)
      return SEARCH_REG.test(targetStr)
    })
    cache.set(text, result)
    return result
  }

  clear () {
    return this.cache.clear()
  }
}

export default Emoji
