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

  ContentState.prototype.search = function (value, opt = {}) {
    value = value.trim()
    let matches = []
    const { caseSensitive, selectHighlight, highlightIndex } = Object.assign(defaultSearchOption, opt)
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
      index = highlightIndex
    } else if (matches.length) {
      index = 0
    }

    if (selectHighlight) {
      const { matches, index } = this.searchMatches
      const light = matches[index]
      if (light) {
        const key = light.key
        this.cursor = {
          start: {
            key,
            offset: light.start
          },
          end: {
            key,
            offset: light.end
          }
        }
      }
    }
    Object.assign(this.searchMatches, { value, matches, index })

    return matches
  }
}

export default searchCtrl
