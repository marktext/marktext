import { Lexer } from '../parser/marked'
import diacritics from 'diacritics-map'

export const getTocFromMarkdown = markdown => {
  const tokens = new Lexer({ disableInline: true }).lex(markdown)
  const toc = []
  let token = null
  while ((token = tokens.shift())) {
    switch (token.type) {
      case 'heading': {
        const { depth, text } = token
        toc.push({
          content: text,
          lvl: depth,
          slug: slugify(text)
        })
        break
      }
    }
  }
  return toc
}

export const slugify = str => {
  str = str.replace(/^\s+|\s+$/g, '').toLowerCase()

  // replace accents
  str = str.replace(/[À-ž]/g, c => {
    return diacritics[c] || c
  })

  return str
    .replace(/[^a-z0-9 -]/g, '') // remove invalid chars
    .replace(/\t/g, '--') // collapse tabs and replace by --
    .replace(/\s+/g, '-') // collapse whitespace and replace by -
    .replace(/^-+/, '') // trim - from start of text
    .replace(/-+$/, '') // trim - from end of text
    .replace(/-+/g, '-') // collapse dashes
}
