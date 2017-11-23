import 'codemirror/addon/edit/closebrackets'
import 'codemirror/addon/edit/closetag'
import 'codemirror/mode/meta'
import codeMirror from 'codemirror/lib/codemirror'

import loadmode from './loadmode'
import 'codemirror/lib/codemirror.css'
import './index.css'

loadmode(codeMirror)
window.CodeMirror = codeMirror

const modes = codeMirror.modeInfo
codeMirror.modeURL = process.env.NODE_ENV !== 'production'
  ? './node_modules/codemirror/mode/%N/%N.js'
  : './codemirror/mode/%N/%N.js'

export const search = text => {
  return modes.filter(mode => {
    return new RegExp(`^${text}`, 'i').test(mode.name)
  })
}

/**
 * set cursor at the end of last line.
 */
export const setCursorAtLastLine = cm => {
  const lastLine = cm.lastLine()
  const lineHandle = cm.getLineHandle(lastLine)

  cm.focus()
  cm.setCursor(lastLine, lineHandle.text.length)
}

// if cursor at firstline return true
export const isCursorAtFirstLine = cm => {
  const cursor = cm.getCursor()
  const { line, ch, outside } = cursor
  return line === 0 && ch === 0 && outside
}

export const isCursorAtLastLine = cm => {
  const lastLine = cm.lastLine()
  const cursor = cm.getCursor()
  const { line, outside, sticky } = cursor
  return line === lastLine && (outside || !sticky)
}

export const isCursorAtBegin = cm => {
  const cursor = cm.getCursor()
  const { line, ch, hitSide } = cursor
  return line === 0 && ch === 0 && hitSide
}

export const onlyHaveOneLine = cm => {
  return cm.lineCount() === 1
}

export const isCursorAtEnd = cm => {
  const lastLine = cm.lastLine()
  const lastLineHandle = cm.getLineHandle(lastLine)
  const cursor = cm.getCursor()
  const { line, ch, hitSide } = cursor
  return line === lastLine && ch === lastLineHandle.text.length && hitSide
}

export const setCursorAtFirstLine = cm => {
  cm.focus()
  cm.setCursor(0, 0)
}

export const setMode = (doc, text) => {
  const m = modes.filter(mode => text === mode.mode)[0]

  if (!m) {
    const errMsg = !text ? 'A language mode should be provided' : `${text} is not a valid language mode!`
    return Promise.reject(errMsg) // eslint-disable-line prefer-promise-reject-errors
  }

  const { mode, mime } = m
  return new Promise(resolve => {
    codeMirror.requireMode(mode, () => {
      doc.setOption('mode', mime)
      codeMirror.autoLoadMode(doc, mode)
      resolve(m)
    })
  })
}

export default codeMirror
