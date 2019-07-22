const defaultSearchOption = {
  caseSensitive: false,
  selectHighlight: false,
  highlightIndex: -1
}

const searchCtrl = ContentState => {
  ContentState.prototype.replaceOne = function (match, value) {
    const {
      start,
      end,
      key
    } = match
    const block = this.getBlock(key)
    const {
      text
    } = block

    block.text = text.substring(0, start) + value + text.substring(end)
  }

  ContentState.prototype.replace = function (replaceValue, opt = { isSingle: true }) {
    const { isSingle, caseSensitive } = opt
    const { matches, value, index } = this.searchMatches
    if (matches.length) {
      if (isSingle) {
        this.replaceOne(matches[index], replaceValue)
      } else {
        // replace all
        for (const match of matches) {
          this.replaceOne(match, replaceValue)
        }
      }
      const highlightIndex = index < matches.length - 1 ? index : index - 1
      this.search(value, { caseSensitive, highlightIndex: isSingle ? highlightIndex : -1 })
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
    value = value.trim()
    const matches = []
    const { caseSensitive, highlightIndex } = Object.assign(defaultSearchOption, opt)
    const { blocks } = this
    const search = blocks => {
      for (const block of blocks) {
        let { text, key } = block
        if (!caseSensitive) {
          text = text.toLowerCase()
          value = value.toLowerCase()
        }
        if (text) {
          let i = text.indexOf(value)
          while (i > -1) {
            matches.push({
              key,
              start: i,
              end: i + value.length
            })
            i = text.indexOf(value, i + value.length)
          }
        }
        if (block.children.length) {
          search(block.children)
        }
      }
    }
    if (value) search(blocks)
    let index = -1
    if (highlightIndex !== -1) {
      index = highlightIndex // If set the highlight index, then highlight the highlighIndex
    } else if (matches.length) {
      index = 0 // highlight the first word that matches.
    }
    Object.assign(this.searchMatches, { value, matches, index })
    if (value) this.setCursorToHighlight()
    return matches
  }
}

export default searchCtrl
