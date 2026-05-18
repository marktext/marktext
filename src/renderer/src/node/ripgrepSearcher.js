// Modified version of https://github.com/atom/atom/blob/master/src/ripgrep-directory-searcher.js
//
// Copyright (c) 2011-2019 GitHub Inc.
//
// Permission is hereby granted, free of charge, to any person obtaining
// a copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to
// permit persons to whom the Software is furnished to do so, subject to
// the following conditions:
//
// The above copyright notice and this permission notice shall be
// included in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
// EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
// NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE
// LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
// OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
// WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

import log from 'electron-log/renderer'

function cleanResultLine (resultLine) {
  resultLine = getText(resultLine)

  return resultLine[resultLine.length - 1] === '\n' ? resultLine.slice(0, -1) : resultLine
}

function getPositionFromColumn (lines, column) {
  let currentLength = 0
  let currentLine = 0
  let previousLength = 0

  while (column >= currentLength) {
    previousLength = currentLength
    currentLength += lines[currentLine].length + 1
    currentLine++
  }

  return [currentLine - 1, column - previousLength]
}

function processUnicodeMatch (match) {
  const text = getText(match.lines)

  if (text.length === window.nodeAPI.bufferByteLength(text)) {
    return
  }

  let remainingBytes = Array.from(new TextEncoder().encode(text))
  let currentLength = 0
  let previousPosition = 0

  function convertPosition (position) {
    const sliceBytes = remainingBytes.slice(0, position - previousPosition)
    const decoded = new TextDecoder().decode(new Uint8Array(sliceBytes))
    currentLength = decoded.length + currentLength
    remainingBytes = remainingBytes.slice(position - previousPosition)
    previousPosition = position
    return currentLength
  }

  for (const submatch of match.submatches) {
    submatch.start = convertPosition(submatch.start)
    submatch.end = convertPosition(submatch.end)
  }
}

function processSubmatch (submatch, lineText, offsetRow) {
  const lineParts = lineText.split('\n')

  const start = getPositionFromColumn(lineParts, submatch.start)
  const end = getPositionFromColumn(lineParts, submatch.end)

  for (let i = start[0]; i > 0; i--) {
    lineParts.shift()
  }
  while (end[0] < lineParts.length - 1) {
    lineParts.pop()
  }

  start[0] += offsetRow
  end[0] += offsetRow

  return {
    range: [start, end],
    lineText: cleanResultLine({ text: lineParts.join('\n') })
  }
}

function getText (input) {
  if ('text' in input) return input.text
  const bytes = Uint8Array.from(atob(input.bytes), c => c.charCodeAt(0))
  return new TextDecoder().decode(bytes)
}

class RipgrepDirectorySearcher {
  search (directories, pattern, options) {
    const didMatch = options.didMatch || (() => {})
    const numPathsFound = { num: 0 }
    let cancelled = false
    let searchId = null

    const promise = new Promise((resolve, reject) => {
      let pendingEvent = null
      let contextBuffer = []

      const handleData = (data) => {
        if (cancelled) return
        if (searchId !== null && data.searchId !== searchId) return
        const { line } = data
        try {
          const message = JSON.parse(line)
          if (message.type === 'begin') {
            pendingEvent = {
              filePath: getText(message.data.path),
              matches: []
            }
            contextBuffer = []
          } else if (message.type === 'context') {
            const contextText = getText(message.data.lines).replace(/\n$/, '')
            contextBuffer.push(contextText)
          } else if (message.type === 'match') {
            const leadingContextLines = contextBuffer.splice(0)
            if (pendingEvent.matches.length > 0) {
              const prevMatch = pendingEvent.matches[pendingEvent.matches.length - 1]
              prevMatch.trailingContextLines = leadingContextLines.splice(
                0, options.trailingContextLineCount || 0
              )
            }
            processUnicodeMatch(message.data)
            for (const submatch of message.data.submatches) {
              const { lineText, range } = processSubmatch(
                submatch,
                getText(message.data.lines),
                message.data.line_number - 1
              )
              pendingEvent.matches.push({
                matchText: getText(submatch.match),
                lineText,
                range,
                leadingContextLines,
                trailingContextLines: []
              })
            }
          } else if (message.type === 'end') {
            if (pendingEvent.matches.length > 0 && contextBuffer.length > 0) {
              const lastMatch = pendingEvent.matches[pendingEvent.matches.length - 1]
              lastMatch.trailingContextLines = contextBuffer.splice(0)
            }
            options.didSearchPaths(++numPathsFound.num)
            didMatch(pendingEvent)
            pendingEvent = null
            contextBuffer = []
          }
        } catch (err) {
          log.warn('Failed to parse ripgrep output line:', line, err)
        }
      }

      const handleDone = (data) => {
        if (searchId !== null && data.searchId !== searchId) return
        window.execAPI.removeRipgrepListeners()
        resolve()
      }

      window.execAPI.onRipgrepData(handleData)
      window.execAPI.onRipgrepDone(handleDone)

      window.execAPI.ripgrepSearch({
        directories,
        pattern,
        options: {
          isRegexp: options.isRegexp,
          isCaseSensitive: options.isCaseSensitive,
          isWholeWord: options.isWholeWord,
          followSymlinks: options.followSymlinks,
          maxFileSize: options.maxFileSize,
          includeHidden: options.includeHidden,
          noIgnore: options.noIgnore,
          leadingContextLineCount: options.leadingContextLineCount,
          trailingContextLineCount: options.trailingContextLineCount,
          inclusions: options.inclusions || [],
          exclusions: options.exclusions || []
        }
      }).then((id) => {
        searchId = id
      }).catch(reject)
    })

    promise.cancel = () => {
      cancelled = true
      if (searchId) window.execAPI.cancelRipgrep(searchId)
      window.execAPI.removeRipgrepListeners()
    }

    return promise
  }
}

export default RipgrepDirectorySearcher
