import { spawn } from 'child_process'
import path from 'path'
import { ipcMain } from 'electron'
import log from 'electron-log'
import { rgPath as bundledRgPath } from '@vscode/ripgrep'

const resolveRgPath = () => {
  if (process.env.MARKTEXT_RIPGREP_PATH) return process.env.MARKTEXT_RIPGREP_PATH
  return bundledRgPath.replace(/\bapp\.asar\b/, 'app.asar.unpacked')
}

const activeSearches = new Map()

const sendIfAlive = (sender, channel, ...args) => {
  try {
    if (sender && !sender.isDestroyed()) sender.send(channel, ...args)
  } catch {}
}

const cleanupAtSenderDestroy = (sender) => {
  if (!sender) return
  const handler = () => {
    for (const [id, entry] of activeSearches.entries()) {
      if (entry.sender === sender) {
        entry.cancel()
        activeSearches.delete(id)
      }
    }
  }
  sender.once('destroyed', handler)
}

const cleanResultLine = (lineText) => {
  const text = getText(lineText)
  return text[text.length - 1] === '\n' ? text.slice(0, -1) : text
}

const getPositionFromColumn = (lines, column) => {
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

const processUnicodeMatch = (match) => {
  const text = getText(match.lines)
  if (text.length === Buffer.byteLength(text)) return
  let remainingBuffer = Buffer.from(text)
  let currentLength = 0
  let previousPosition = 0
  const convertPosition = (position) => {
    const currentBuffer = remainingBuffer.slice(0, position - previousPosition)
    currentLength = currentBuffer.toString().length + currentLength
    remainingBuffer = remainingBuffer.slice(position - previousPosition)
    previousPosition = position
    return currentLength
  }
  for (const submatch of match.submatches) {
    submatch.start = convertPosition(submatch.start)
    submatch.end = convertPosition(submatch.end)
  }
}

const processSubmatch = (submatch, lineText, offsetRow) => {
  const lineParts = lineText.split('\n')
  const start = getPositionFromColumn(lineParts, submatch.start)
  const end = getPositionFromColumn(lineParts, submatch.end)
  for (let i = start[0]; i > 0; i--) lineParts.shift()
  while (end[0] < lineParts.length - 1) lineParts.pop()
  start[0] += offsetRow
  end[0] += offsetRow
  return {
    range: [start, end],
    lineText: cleanResultLine({ text: lineParts.join('\n') })
  }
}

const getText = (input) =>
  'text' in input ? input.text : Buffer.from(input.bytes, 'base64').toString()

const prepareGlobs = (globs, projectRootPath, sep) => {
  const output = []
  for (let pattern of globs || []) {
    pattern = pattern.replace(new RegExp(`\\${sep || path.sep}`, 'g'), '/')
    if (pattern.length === 0) continue
    const projectName = path.basename(projectRootPath)
    if (pattern === projectName) {
      output.push('**/*')
      continue
    }
    if (pattern.startsWith(projectName + '/')) {
      pattern = pattern.slice(projectName.length + 1)
    }
    if (pattern.endsWith('/')) pattern = pattern.slice(0, -1)
    pattern = pattern.startsWith('**/') ? pattern : `**/${pattern}`
    output.push(pattern)
    output.push(pattern.endsWith('/**') ? pattern : `${pattern}/**`)
  }
  return output
}

const prepareRegexp = (regexpStr) => {
  if (regexpStr === '--') return '\\-\\-'
  return regexpStr.replace(/\\\//g, '/')
}

const isMultilineRegexp = (regexpStr) => regexpStr.includes('\\n')

const startTextSearch = (sender, searchId, directories, pattern, options) => {
  const rgPath = resolveRgPath()
  const children = []
  let cancelled = false
  let pendingPaths = 0
  let pendingDirs = directories.length
  let finished = false

  const finishIfDone = (err) => {
    if (finished) return
    if (pendingDirs === 0 || err) {
      finished = true
      activeSearches.delete(searchId)
      if (err) sendIfAlive(sender, 'mt::rg::error', { searchId, error: String(err?.message || err) })
      else sendIfAlive(sender, 'mt::rg::done', { searchId })
    }
  }

  const cancel = () => {
    cancelled = true
    for (const child of children) {
      try { child.kill() } catch {}
    }
    if (!finished) {
      finished = true
      activeSearches.delete(searchId)
      sendIfAlive(sender, 'mt::rg::cancelled', { searchId })
    }
  }
  activeSearches.set(searchId, { sender, cancel })

  for (const directoryPath of directories) {
    let regexpStr = null
    let textPattern = null
    const args = ['--json']
    if (options.isRegexp) {
      regexpStr = prepareRegexp(pattern)
      args.push('--regexp', regexpStr)
    } else {
      args.push('--fixed-strings')
      textPattern = pattern
    }
    if (regexpStr && isMultilineRegexp(regexpStr)) args.push('--multiline')
    if (options.isCaseSensitive) args.push('--case-sensitive')
    else args.push('--ignore-case')
    if (options.isWholeWord) args.push('--word-regexp')
    if (options.followSymlinks) args.push('--follow')
    if (options.maxFileSize) args.push('--max-filesize', options.maxFileSize + '')
    if (options.includeHidden) args.push('--hidden')
    if (options.noIgnore) args.push('--no-ignore')
    if (options.leadingContextLineCount) args.push('--before-context', String(options.leadingContextLineCount))
    if (options.trailingContextLineCount) args.push('--after-context', String(options.trailingContextLineCount))
    for (const inclusion of prepareGlobs(options.inclusions, directoryPath)) args.push('--iglob', inclusion)
    for (const exclusion of prepareGlobs(options.exclusions, directoryPath)) args.push('--iglob', '!' + exclusion)
    args.push('--')
    if (textPattern) args.push(textPattern)
    args.push(directoryPath)

    let child
    try {
      child = spawn(rgPath, args, { cwd: directoryPath, stdio: ['pipe', 'pipe', 'pipe'] })
    } catch (err) {
      finishIfDone(err)
      return
    }
    children.push(child)

    let buffer = ''
    let bufferError = ''
    let pendingEvent = null
    let pendingLeadingContext = []
    let pendingTrailingContexts = new Set()

    child.on('close', (code) => {
      if (code !== null && code > 1 && bufferError) {
        log.warn('Ripgrep finished with errors (exit code ' + code + '):', bufferError)
      }
      if (buffer && !cancelled) {
        try {
          const message = JSON.parse(buffer)
          if (message.type === 'end' && pendingEvent) {
            pendingPaths++
            sendIfAlive(sender, 'mt::rg::progress', { searchId, num: pendingPaths })
            sendIfAlive(sender, 'mt::rg::match', { searchId, payload: pendingEvent })
          }
        } catch {}
      }
      pendingDirs--
      finishIfDone()
    })
    child.on('error', (err) => finishIfDone(err))
    child.stderr.on('data', (chunk) => { bufferError += chunk })
    child.stdout.on('data', (chunk) => {
      if (cancelled) return
      buffer += chunk
      const lines = buffer.split('\n')
      buffer = lines.pop()
      for (const line of lines) {
        if (!line) continue
        try {
          const message = JSON.parse(line)
          if (message.type === 'begin') {
            pendingEvent = { filePath: getText(message.data.path), matches: [] }
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
            pendingPaths++
            sendIfAlive(sender, 'mt::rg::progress', { searchId, num: pendingPaths })
            sendIfAlive(sender, 'mt::rg::match', { searchId, payload: pendingEvent })
            pendingEvent = null
          }
        } catch (err) {
          log.warn('Failed to parse ripgrep output line:', line, err)
        }
      }
    })
  }
}

const startFileSearch = (sender, searchId, directories, options) => {
  const rgPath = resolveRgPath()
  const children = []
  let cancelled = false
  let pendingPaths = 0
  let pendingDirs = directories.length
  let finished = false

  const finishIfDone = (err) => {
    if (finished) return
    if (pendingDirs === 0 || err) {
      finished = true
      activeSearches.delete(searchId)
      if (err) sendIfAlive(sender, 'mt::rg::error', { searchId, error: String(err?.message || err) })
      else sendIfAlive(sender, 'mt::rg::done', { searchId })
    }
  }

  const cancel = () => {
    cancelled = true
    for (const child of children) {
      try { child.kill() } catch {}
    }
    if (!finished) {
      finished = true
      activeSearches.delete(searchId)
      sendIfAlive(sender, 'mt::rg::cancelled', { searchId })
    }
  }
  activeSearches.set(searchId, { sender, cancel })

  for (const directoryPath of directories) {
    const args = ['--files']
    if (options.followSymlinks) args.push('--follow')
    if (options.includeHidden) args.push('--hidden')
    if (options.noIgnore) args.push('--no-ignore')
    for (const inclusion of prepareGlobs(options.inclusions, directoryPath)) args.push('--iglob', inclusion)
    args.push('--')
    args.push(directoryPath)

    let child
    try {
      child = spawn(rgPath, args, { cwd: directoryPath, stdio: ['pipe', 'pipe', 'pipe'] })
    } catch (err) {
      finishIfDone(err)
      return
    }
    children.push(child)

    let buffer = ''
    let bufferError = ''
    child.on('close', (code) => {
      if (code !== null && code > 1) {
        finishIfDone(new Error(bufferError))
        return
      }
      pendingDirs--
      finishIfDone()
    })
    child.on('error', (err) => finishIfDone(err))
    child.stderr.on('data', (chunk) => { bufferError += chunk })
    child.stdout.on('data', (chunk) => {
      if (cancelled) return
      buffer += chunk
      const lines = buffer.split('\n')
      buffer = lines.pop()
      for (const line of lines) {
        pendingPaths++
        sendIfAlive(sender, 'mt::rg::progress', { searchId, num: pendingPaths })
        sendIfAlive(sender, 'mt::rg::match', { searchId, payload: line })
      }
    })
  }
}

export const registerRipgrepHandlers = () => {
  ipcMain.handle('mt::rg::start', (event, req) => {
    const { searchId, mode, directories, pattern, options } = req
    cleanupAtSenderDestroy(event.sender)
    if (mode === 'files') startFileSearch(event.sender, searchId, directories, options || {})
    else startTextSearch(event.sender, searchId, directories, pattern, options || {})
    return true
  })
  ipcMain.on('mt::rg::cancel', (_event, searchId) => {
    const entry = activeSearches.get(searchId)
    if (entry) entry.cancel()
  })
}
