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

export const setMode = (doc, text) => {
  const m = modes.filter(mode => text === mode.mode)[0]

  if (!m) {
    return Promise.reject(`${text} is not a valid language mode!`) // eslint-disable-line prefer-promise-reject-errors
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
