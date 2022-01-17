import execAll from 'execall'
import { defaultSearchOption } from '../config'

const matchString = (text, value, options) => {
  const { isCaseSensitive, isWholeWord, isRegexp } = options
  /* eslint-disable no-useless-escape */
  const SPECIAL_CHAR_REG = /[\[\]\\^$.\|\?\*\+\(\)\/]{1}/g
  /* eslint-enable no-useless-escape */
  let SEARCH_REG = null
  let regStr = value
  let flag = 'g'

  if (!isCaseSensitive) {
    flag += 'i'
  }

  if (!isRegexp) {
    regStr = value.replace(SPECIAL_CHAR_REG, (p) => {
      return p === '\\' ? '\\\\' : `\\${p}`
    })
  }

  if (isWholeWord) {
    regStr = `\\b${regStr}\\b`
  }

  try {
    // Add try catch expression because not all string can generate a valid RegExp. for example `\`.
    SEARCH_REG = new RegExp(regStr, flag)
    return execAll(SEARCH_REG, text)
  } catch (err) {
    return []
  }
}

const searchCtrl = ContentState => {
  ContentState.prototype.buildRegexValue = function (match, value) {
    const groups = value.match(/(?<!\\)\$\d/g)

    if (Array.isArray(groups) && groups.length) {
      for (const group of groups) {
        const index = parseInt(group.replace(/^\$/, ''))
        if (index === 0) {
          value = value.replace(group, match.match)
        } else if (index > 0 && index <= match.subMatches.length) {
          value = value.replace(group, match.subMatches[index - 1])
        }
      }
    }

    return value
  }

  ContentState.prototype.replaceOne = function (match, value) {
    const { start, end, key } = match
    const block = this.getBlock(key)
    const { text } = block
    block.text = text.substring(0, start) + value + text.substring(end)
  }

  ContentState.prototype.replace = function (replaceValue, opt = { isSingle: true }) {
    const { isSingle, isRegexp } = opt
    delete opt.isSingle
    const searchOptions = Object.assign({}, defaultSearchOption, opt)
    const { matches, value, index } = this.searchMatches
    if (matches.length) {
      if (isRegexp) {
        replaceValue = this.buildRegexValue(matches[index], replaceValue)
      }
      if (isSingle) {
        // replace single
        this.replaceOne(matches[index], replaceValue)
      } else {
        // replace all
        for (const match of matches) {
          this.replaceOne(match, replaceValue)
        }
      }
      const highlightIndex = index < matches.length - 1 ? index : index - 1
      this.search(value, { ...searchOptions, highlightIndex: isSingle ? highlightIndex : -1 })
    }
  }

  ContentState.prototype.setCursorToHighlight = function () {
    const { matches, index } = this.searchMatches
    const match = matches[index]

    if (!match) return
    const { key, start, end } = match

    this.cursor = {
      noHistory: true,
      start: {
        key,
        offset: start
      },
      end: {
        key,
        offset: end
      }
    }
  }

  ContentState.prototype.find = function (action/* prev next */) {
    let { matches, index } = this.searchMatches
    const len = matches.length
    if (!len) return
    index = action === 'next' ? index + 1 : index - 1
    if (index < 0) index = len - 1
    if (index >= len) index = 0
    this.searchMatches.index = index

    this.setCursorToHighlight()
  }

  ContentState.prototype.search = function (value, opt = {}) {
    const matches = []
    const options = Object.assign({}, defaultSearchOption, opt)
    const { highlightIndex } = options
    const { blocks } = this
    const travel = blocks => {
      for (const block of blocks) {
        let { text, key } = block

        if (text && typeof text === 'string') {
          const strMatches = matchString(text, value, options)
          matches.push(...strMatches.map(({ index, match, subMatches }) => {
            return {
              key,
              start: index,
              end: index + match.length,
              match,
              subMatches
            }
          }))
        }
        if (block.children.length) {
          travel(block.children)
        }
      }
    }
    if (value) travel(blocks)
    let index = -1
    if (highlightIndex !== -1) {
      index = highlightIndex // If set the highlight index, then highlight the highlighIndex
    } else if (matches.length) {
      index = 0 // highlight the first word that matches.
    }
    Object.assign(this.searchMatches, { value, matches, index })
    if (value) {
      this.setCursorToHighlight()
    }
    return matches
  }
}

export default searchCtrl
