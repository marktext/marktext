import { downcode } from './urlify'

/**
 * Slugger generates header id
 */

function Slugger() {
  this.seen = {}
  this.downcodeUnicode = true
}

/**
 * Convert string to unique id
 */

Slugger.prototype.slug = function(value) {
  // Strip HTML tags and LATIN_SYMBOLS_MAP chars ($%&|<>|'") before downcoding,
  // otherwise downcode() converts them to English words (e.g. '$' \u2192 'dollar',
  // '|' \u2192 'or') which then survive the special-char removal regex below.
  let slug = value
    .replace(/<[!\/a-z].*?>/ig, '') // eslint-disable-line no-useless-escape
    .replace(/[$%&|<>'"]/g, '')
  slug = this.downcodeUnicode ? downcode(slug) : slug
  slug = slug
    .toLowerCase()
    .trim()
    .replace(/[\u2000-\u206F\u2E00-\u2E7F\\'!"#$%&()*+,./:;<=>?@[\]^`{|}~]/g, '')
    .replace(/\s/g, '-')

  // Use a fallback slug when heading content is empty or contains only special characters.
  // An empty slug would produce an invalid CSS selector '#'. See #4087.
  if (!slug) {
    slug = 'heading'
  }

  if (this.seen.hasOwnProperty(slug)) {
    const originalSlug = slug
    do {
      this.seen[originalSlug]++
      slug = originalSlug + '-' + this.seen[originalSlug]
    } while (this.seen.hasOwnProperty(slug))
  }
  this.seen[slug] = 0

  return slug
}

export default Slugger
