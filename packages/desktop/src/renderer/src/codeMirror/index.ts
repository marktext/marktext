import { filter } from 'fuzzaldrin'
import 'codemirror/addon/edit/closebrackets'
import 'codemirror/addon/edit/closetag'
import 'codemirror/addon/selection/active-line'
import 'codemirror/mode/meta'
import codeMirror from 'codemirror/lib/codemirror'
import type CodeMirror from 'codemirror'

import loadmode from './loadmode'
import overlayMode from './overlayMode'
import multiplexMode from './mltiplexMode'
import registerMarkdownMathMode from './markdownMathMode'
import languages from './modes'
import 'codemirror/lib/codemirror.css'
import './index.css'
import 'codemirror/theme/railscasts.css'

// The runtime is imported from `codemirror/lib/codemirror` (an `any` shim), but
// the public editor surface is typed via `@types/codemirror`.
// Only the legacy `window.CodeMirror` exposure references this; never read typed.
type CodeMirrorLike = unknown
type CodeMirrorInstance = CodeMirror.Editor
type CodeMirrorDoc = CodeMirror.Doc
// `getCursor()` returns extra runtime flags not present on the typed `Position`.
type CursorPosition = CodeMirror.Position & { outside?: boolean; hitSide?: boolean }

interface ModeInfoEntry {
  name?: string
  mime?: string | string[]
  mimes?: string[]
  mode?: string
  [key: string]: unknown
}

interface MatchedMode {
  name: string
  mode: ModeInfoEntry
}

loadmode(codeMirror)
overlayMode(codeMirror)
multiplexMode(codeMirror)
registerMarkdownMathMode(codeMirror)
;(window as unknown as { CodeMirror: CodeMirrorLike }).CodeMirror = codeMirror

const modes: ModeInfoEntry[] = codeMirror.modeInfo
codeMirror.modeURL = '../../../../node_modules/codemirror/mode/%N/%N.js'

const getModeFromName = (name: string): MatchedMode | null => {
  let result: MatchedMode | null = null
  const lang = languages.filter((lang) => lang.name === name)[0]
  if (lang) {
    const { name, mode, mime } = lang
    const matched = modes.filter((m) => {
      if (m.mime) {
        if (Array.isArray(m.mime) && m.mime.indexOf(mime) > -1 && m.mode === mode) {
          return true
        } else if (typeof m.mime === 'string' && m.mime === mime && m.mode === mode) {
          return true
        }
      }
      if (Array.isArray(m.mimes) && m.mimes.indexOf(mime) > -1 && m.mode === mode) {
        return true
      }
      return false
    })
    if (matched.length && typeof matched[0] === 'object') {
      result = {
        name,
        mode: matched[0]
      }
    }
  }
  return result
}

export const search = (text: string): MatchedMode[] => {
  const matchedLangs = filter(languages, text, { key: 'name' })
  return matchedLangs
    .map(({ name }: { name: string }) => getModeFromName(name))
    .filter((lang: MatchedMode | null): lang is MatchedMode => !!lang)
}

/**
 * set cursor at the end of last line.
 */
export const setCursorAtLastLine = (cm: CodeMirrorInstance): void => {
  const lastLine = cm.lastLine()
  const lineHandle = cm.getLineHandle(lastLine)

  cm.focus()
  cm.setCursor(lastLine, lineHandle.text.length)
}

// if cursor at firstLine return true
export const isCursorAtFirstLine = (cm: CodeMirrorInstance): boolean => {
  const cursor = cm.getCursor() as CursorPosition
  const { line, ch, outside } = cursor

  return line === 0 && ch === 0 && !!outside
}

export const isCursorAtLastLine = (cm: CodeMirrorInstance): boolean => {
  const lastLine = cm.lastLine()
  const cursor = cm.getCursor() as CursorPosition
  const { line, outside, sticky } = cursor
  return line === lastLine && (outside || !sticky)
}

export const isCursorAtBegin = (cm: CodeMirrorInstance): boolean => {
  const cursor = cm.getCursor() as CursorPosition
  const { line, ch, hitSide } = cursor
  return line === 0 && ch === 0 && !!hitSide
}

export const onlyHaveOneLine = (cm: CodeMirrorInstance): boolean => {
  return cm.lineCount() === 1
}

export const isCursorAtEnd = (cm: CodeMirrorInstance): boolean => {
  const lastLine = cm.lastLine()
  const lastLineHandle = cm.getLineHandle(lastLine)
  const cursor = cm.getCursor() as CursorPosition
  const { line, ch, hitSide } = cursor

  return line === lastLine && ch === lastLineHandle.text.length && !!hitSide
}

export const getBeginPosition = (): {
  anchor: { line: number; ch: number }
  head: { line: number; ch: number }
} => {
  return {
    anchor: { line: 0, ch: 0 },
    head: { line: 0, ch: 0 }
  }
}

export const getEndPosition = (
  cm: CodeMirrorInstance
): {
  anchor: { line: number; ch: number }
  head: { line: number; ch: number }
} => {
  const lastLine = cm.lastLine()
  const lastLineHandle = cm.getLineHandle(lastLine)
  const line = lastLine
  const ch = lastLineHandle.text.length
  return { anchor: { line, ch }, head: { line, ch } }
}

export const setCursorAtFirstLine = (cm: CodeMirrorInstance): void => {
  cm.focus()
  cm.setCursor(0, 0)
}

export const setMode = (doc: CodeMirrorDoc, text: string): Promise<MatchedMode> => {
  const m = getModeFromName(text)

  if (!m) {
    const errMsg = !text
      ? "You'd better provided a language mode when you create code block"
      : `${text} is not a valid language mode!`
    return Promise.reject(errMsg)
  }

  const { mode, mime } = m.mode as { mode: string; mime: string | string[] }
  return new Promise((resolve) => {
    codeMirror.requireMode(mode, () => {
      ;(doc as unknown as { setOption(option: string, value: unknown): void }).setOption(
        'mode',
        mime || mode
      )
      codeMirror.autoLoadMode(doc, mode)
      resolve(m)
    })
  })
}

export const setTextDirection = (cm: CodeMirrorInstance, textDirection: string): void => {
  cm.setOption('direction', textDirection as 'ltr' | 'rtl')
}

export default codeMirror
