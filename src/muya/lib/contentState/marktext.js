// __MARKTEXT_ONLY__

import { extractWord, offsetToWordCursor, validateLineCursor } from '../marktext/spellchecker'
import selection from '../selection'

const marktextApi = ContentState => {
  /**
   * Replace the current selected word with the given replacement.
   *
   * NOTE: Unsafe method because exacly one word have to be selected. This
   * is currently used to replace a misspelled word in MarkText that was selected
   * by Chromium.
   *
   * @param {string} word The old word that should be replaced. The whole word must be selected.
   * @param {string} replacement The word to replace the selecte one.
   * @returns {boolean} True on success.
   */
  ContentState.prototype._replaceCurrentWordInlineUnsafe = function (word, replacement) {
    // Right clicking on a misspelled word select the whole word by Chromium.
    const { start, end } = selection.getCursorRange()
    const cursor = Object.assign({}, { start, end })
    cursor.start.block = this.getBlock(start.key)

    if (!validateLineCursor(cursor)) {
      console.warn('Unable to replace word: multiple lines are selected.', JSON.stringify(cursor))
      return false
    }

    const { start: startCursor } = cursor
    const { offset: lineOffset } = startCursor
    const { text } = startCursor.block
    const wordInfo = extractWord(text, lineOffset)
    if (wordInfo) {
      const { left, right, word: selectedWord } = wordInfo
      if (selectedWord !== word) {
        console.warn(`Unable to replace word: Chromium selection mismatch (expected "${selectedWord}" but found "${word}").`)
        return false
      }

      // Translate offsets into a cursor with the given line.
      const wordRange = offsetToWordCursor(this.cursor, left, right)
      this.replaceWordInline(cursor, wordRange, replacement, true)
      return true
    }
    return false
  }
}

export default marktextApi
