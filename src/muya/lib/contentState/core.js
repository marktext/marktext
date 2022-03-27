const coreApi = ContentState => {
  /**
   * Replace the word range with the given replacement.
   *
   * @param {*} line A line block reference of the line that contain the word to
   *                 replace - must be a valid reference.
   * @param {*} wordCursor The range of the word to replace (line: "abc >foo< abc"
   *                       where `>`/`<` is start and end of `wordCursor`). This
   *                       range is replaced by `replacement`.
   * @param {string} replacement The replacement.
   * @param {boolean} setCursor Whether the editor cursor should be updated.
   */
  ContentState.prototype.replaceWordInline = function (line, wordCursor, replacement, setCursor = false) {
    const { start: lineStart, end: lineEnd } = line
    const { start: wordStart, end: wordEnd } = wordCursor

    // Validate cursor ranges.
    if (wordStart.key !== wordEnd.key) {
      throw new Error('Expect a single line word cursor: "start.key" is not equal to "end.key".')
    } else if (lineStart.key !== lineEnd.key) {
      throw new Error('Expect a single line line cursor: "start.key" is not equal to "end.key".')
    } else if (wordStart.offset > wordEnd.offset) {
      throw new Error(`Invalid word cursor offset: ${wordStart.offset} should be less ${wordEnd.offset}.`)
    } else if (lineStart.key !== wordEnd.key) {
      throw new Error(`Cursor mismatch: Expect the same line but got ${lineStart.key} and ${wordEnd.key}.`)
    } else if (lineStart.block.text.length < wordEnd.offset) {
      throw new Error('Invalid cursor: Replacement length is larger than line length.')
    }

    const { block } = lineStart
    const { offset: left } = wordStart
    const { offset: right } = wordEnd

    // Replace word range with replacement.
    block.text = block.text.substr(0, left) + replacement + block.text.substr(right)

    // Update cursor
    if (setCursor) {
      const cursor = Object.assign({}, wordStart, {
        offset: left + replacement.length
      })
      line.start = cursor
      line.end = cursor
      this.cursor = {
        start: cursor,
        end: cursor
      }
    }

    this.partialRender()
    this.muya.dispatchSelectionChange()
    this.muya.dispatchChange()
  }
}

export default coreApi
