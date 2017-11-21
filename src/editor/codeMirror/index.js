import 'codemirror/addon/edit/closebrackets'
import 'codemirror/addon/edit/closetag'
import 'codemirror/addon/mode/loadmode'
import 'codemirror/mode/meta.js'
import codeMirror from 'codemirror/lib/codemirror'

import 'codemirror/lib/codemirror.css'
import './index.css'

const modes = codeMirror.modeInfo
codeMirror.modeURL = 'codemirror/mode/%N/%N.js'

export const search = text => {
  return modes.filter(mode => {
    return new RegExp(`^${text}`, 'i').test(mode.mode)
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
