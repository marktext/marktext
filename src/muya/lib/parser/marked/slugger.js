import { downcode } from './urlify'

/**
 * Slugger generates header id
 */

function Slugger () {
  this.seen = {}
  this.downcodeUnicode = true
}

/**
 * Convert string to unique id
 */

Slugger.prototype.slug = function (value) {
  let slug = this.downcodeUnicode ? downcode(value) : value
  slug = slug
    .toLowerCase()
    .trim()
    // remove html tags
    .replace(/<[!\/a-z].*?>/ig, '') // eslint-disable-line no-useless-escape
    // remove unwanted chars
    .replace(/[\u2000-\u206F\u2E00-\u2E7F\\'!"#$%&()*+,./:;<=>?@[\]^`{|}~]/g, '')
    .replace(/\s/g, '-')

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
