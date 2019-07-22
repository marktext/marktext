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

import { spawn } from 'child_process'
import path from 'path'

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

  if (text.length === Buffer.byteLength(text)) {
    // fast codepath for lines that only contain characters of 1 byte length.
    return
  }

  let remainingBuffer = Buffer.from(text)
  let currentLength = 0
  let previousPosition = 0

  function convertPosition (position) {
    const currentBuffer = remainingBuffer.slice(0, position - previousPosition)
    currentLength = currentBuffer.toString().length + currentLength
    remainingBuffer = remainingBuffer.slice(position)

    previousPosition = position

    return currentLength
  }

  // Iterate over all the submatches to find the convert the start and end values
  // (which come as bytes from ripgrep) to character positions.
  // We can do this because submatches come ordered by position.
  for (const submatch of match.submatches) {
    submatch.start = convertPosition(submatch.start)
    submatch.end = convertPosition(submatch.end)
  }
}

// This function processes a ripgrep submatch to create the correct
// range. This is mostly needed for multi-line results, since the range
// will have differnt start and end rows and we need to calculate these
// based on the lines that ripgrep returns.
function processSubmatch (submatch, lineText, offsetRow) {
  const lineParts = lineText.split('\n')

  const start = getPositionFromColumn(lineParts, submatch.start)
  const end = getPositionFromColumn(lineParts, submatch.end)

  // Make sure that the lineText string only contains lines that are
  // relevant to this submatch. This means getting rid of lines above
  // the start row and below the end row.
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
  return 'text' in input ? input.text : Buffer.from(input.bytes, 'base64').toString()
}

class RipgrepDirectorySearcher {
  constructor () {
    this.rgPath = global.marktext.paths.ripgrepBinaryPath
  }

  // Performs a text search for files in the specified `Directory`s, subject to the
  // specified parameters.
  //
  // Results are streamed back to the caller by invoking methods on the specified `options`,
  // such as `didMatch`.
  //
  // * `directories` {Array} of absolute {string} paths to search.
  // * `pattern` {string} to search with.
  // * `options` {Object} with the following properties:
  //   * `didMatch` {Function} call with a search result structured as follows:
  //     * `searchResult` {Object} with the following keys:
  //       * `filePath` {String} absolute path to the matching file.
  //       * `matches` {Array} with object elements with the following keys:
  //         * `lineText` {String} The full text of the matching line (without a line terminator character).
  //         * `matchText` {String} The text that matched the `regex` used for the search.
  //         * `range` {Range} Identifies the matching region in the file. (Likely as an array of numeric arrays.)
  //   * `didSearchPaths` {Function} periodically call with the number of paths searched that contain results thus far.
  //   * `inclusions` {Array} of glob patterns (as strings) to search within. Note that this
  //   array may be empty, indicating that all files should be searched.
  //
  //   Each item in the array is a file/directory pattern, e.g., `src` to search in the "src"
  //   directory or `*.js` to search all JavaScript files. In practice, this often comes from the
  //   comma-delimited list of patterns in the bottom text input of the ProjectFindView dialog.
  //   * `noIgnore` {boolean} whether to ignore ignore files like `.gitignore`.
  //   * `exclusions` {Array} similar to inclusions
  //   * `followSymlinks` {boolean} whether symlinks should be followed.
  //   * `isWholeWord` {boolean} whether to search for whole words.
  //   * `isRegexp` {boolean} whether `pattern` is a RegEx.
  //   * `isCaseSensitive` {boolean} whether to search case sensitive or not.
  //   * `maxFileSize` {number} the maximal file size.
  //   * `includeHidden` {boolean} whether to search in hidden files and directories.

  // Returns a *thenable* `DirectorySearch` that includes a `cancel()` method. If `cancel()` is
  // invoked before the `DirectorySearch` is determined, it will resolve the `DirectorySearch`.
  search (directories, pattern, options) {
    const numPathsFound = { num: 0 }

    const allPromises = directories.map(
      directory => this.searchInDirectory(directory, pattern, options, numPathsFound)
    )

    const promise = Promise.all(allPromises)

    promise.cancel = () => {
      for (const promise of allPromises) {
        promise.cancel()
      }
    }

    return promise
  }

  searchInDirectory (directoryPath, pattern, options, numPathsFound) {
    let regexpStr = null
    let textPattern = null
    const args = ['--json']

    if (options.isRegexp) {
      regexpStr = this.prepareRegexp(pattern)
      args.push('--regexp', regexpStr)
    } else {
      args.push('--fixed-strings')
      textPattern = pattern
    }

    if (regexpStr && this.isMultilineRegexp(regexpStr)) {
      args.push('--multiline')
    }

    if (options.isCaseSensitive) {
      args.push('--case-sensitive')
    } else {
      args.push('--ignore-case')
    }
    if (options.isWholeWord) {
      args.push('--word-regexp')
    }
    if (options.followSymlinks) {
      args.push('--follow')
    }
    if (options.maxFileSize) {
      args.push('--max-filesize', options.maxFileSize + '')
    }
    if (!options.includeHidden) {
      args.push('--hidden')
    }
    if (options.noIgnore) {
      args.push('--no-ignore')
    }

    if (options.leadingContextLineCount) {
      args.push('--before-context', options.leadingContextLineCount)
    }
    if (options.trailingContextLineCount) {
      args.push('--after-context', options.trailingContextLineCount)
    }
    for (const inclusion of this.prepareGlobs(options.inclusions, directoryPath)) {
      args.push('--glob', inclusion)
    }
    for (const exclusion of this.prepareGlobs(options.exclusions, directoryPath)) {
      args.push('--glob', '!' + exclusion)
    }

    args.push('--')

    if (textPattern) {
      args.push(textPattern)
    }

    args.push(directoryPath)

    let child = null
    try {
      child = spawn(this.rgPath, args, {
        cwd: directoryPath,
        stdio: ['pipe', 'pipe', 'pipe']
      })
    } catch (err) {
      return Promise.reject(err)
    }

    const didMatch = options.didMatch || (() => {})
    let cancelled = false

    const returnedPromise = new Promise((resolve, reject) => {
      let buffer = ''
      let bufferError = ''
      let pendingEvent
      let pendingLeadingContext
      let pendingTrailingContexts

      child.on('close', (code, signal) => {
        // code 1 is used when no results are found.
        if (code !== null && code > 1) {
          reject(new Error(bufferError))
        } else {
          resolve()
        }
      })
      child.on('error', err => {
        reject(err)
      })

      child.stderr.on('data', chunk => {
        bufferError += chunk
      })

      child.stdout.on('data', chunk => {
        if (cancelled) {
          return
        }

        buffer += chunk
        const lines = buffer.split('\n')
        buffer = lines.pop()
        for (const line of lines) {
          const message = JSON.parse(line)

          if (message.type === 'begin') {
            pendingEvent = {
              filePath: getText(message.data.path),
              matches: []
            }
            pendingLeadingContext = []
            pendingTrailingContexts = new Set()
          } else if (message.type === 'match') {
            const trailingContextLines = []
            pendingTrailingContexts.add(trailingContextLines)

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
                leadingContextLines: [...pendingLeadingContext],
                trailingContextLines
              })
            }
          } else if (message.type === 'end') {
            options.didSearchPaths(++numPathsFound.num)
            didMatch(pendingEvent)
            pendingEvent = null
          }
        }
      })
    })

    returnedPromise.cancel = () => {
      child.kill()
      cancelled = true
    }

    return returnedPromise
  }

  // We need to prepare the "globs" that we receive from the user to make their behaviour more
  // user-friendly (e.g when adding `src/` the user probably means `src/**/*`).
  // This helper function takes care of that.
  prepareGlobs (globs, projectRootPath) {
    const output = []

    for (let pattern of globs) {
      // we need to replace path separators by slashes since globs should
      // always use always slashes as path separators.
      pattern = pattern.replace(new RegExp(`\\${path.sep}`, 'g'), '/')

      if (pattern.length === 0) {
        continue
      }

      const projectName = path.basename(projectRootPath)

      // The user can just search inside one of the opened projects. When we detect
      // this scenario we just consider the glob to include every file.
      if (pattern === projectName) {
        output.push('**/*')
        continue
      }

      if (pattern.startsWith(projectName + '/')) {
        pattern = pattern.slice(projectName.length + 1)
      }

      if (pattern.endsWith('/')) {
        pattern = pattern.slice(0, -1)
      }

      pattern = pattern.startsWith('**/') ? pattern : `**/${pattern}`

      output.push(pattern)
      output.push(pattern.endsWith('/**') ? pattern : `${pattern}/**`)
    }

    return output
  }

  prepareRegexp (regexpStr) {
    // ripgrep handles `--` as the arguments separator, so we need to escape it if the
    // user searches for that exact same string.
    if (regexpStr === '--') {
      return '\\-\\-'
    }

    // ripgrep is quite picky about unnecessarily escaped sequences, so we need to unescape
    // them: https://github.com/BurntSushi/ripgrep/issues/434.
    regexpStr = regexpStr.replace(/\\\//g, '/')

    return regexpStr
  }

  isMultilineRegexp (regexpStr) {
    if (regexpStr.includes('\\n')) {
      return true
    }

    return false
  }
}

export default RipgrepDirectorySearcher
