import path from 'path'
import { ipcRenderer } from 'electron'
import log from 'electron-log'
import RendererPaths from './node/paths'

let exceptionLogger = s => console.error(s)

const configureLogger = () => {
  const { debug, paths, windowId } = global.marktext.env
  log.transports.console.level = process.env.NODE_ENV === 'development' ? 'info' : false // mirror to window console
  log.transports.mainConsole = null
  log.transports.file.resolvePath = () => path.join(paths.logPath, `editor-${windowId}.log`)
  log.transports.file.level = debug ? 'debug' : 'info'
  log.transports.file.sync = false
  exceptionLogger = log.error
}

const parseUrlArgs = () => {
  const params = new URLSearchParams(window.location.search)
  const codeFontFamily = params.get('cff')
  const codeFontSize = params.get('cfs')
  const debug = params.get('debug') === '1'
  const hideScrollbar = params.get('hsb') === '1'
  const theme = params.get('theme')
  const titleBarStyle = params.get('tbs')
  const userDataPath = params.get('udp')
  const windowId = Number(params.get('wid'))
  const type = params.get('type')
  const spellcheckerIsHunspell = params.get('slp') === '1'

  if (Number.isNaN(windowId)) {
    throw new Error('Error while parsing URL arguments: windowId!')
  }

  return {
    type,
    debug,
    userDataPath,
    windowId,
    initialState: {
      codeFontFamily,
      codeFontSize,
      hideScrollbar,
      theme,
      titleBarStyle
    },
    spellcheckerIsHunspell
  }
}

const bootstrapRenderer = () => {
  // Register renderer exception handler
  window.addEventListener('error', event => {
    if (event.error) {
      const { message, name, stack } = event.error
      const copy = {
        message,
        name,
        stack
      }

      exceptionLogger(event.error)

      // Pass exception to main process exception handler to show a error dialog.
      ipcRenderer.send('mt::handle-renderer-error', copy)
    } else {
      console.error(event)
    }
  })

  const {
    debug,
    initialState,
    userDataPath,
    windowId,
    type,
    spellcheckerIsHunspell
  } = parseUrlArgs()
  const paths = new RendererPaths(userDataPath)
  const marktext = {
    initialState,
    env: {
      debug,
      paths,
      windowId,
      type
    },
    paths
  }
  global.marktext = marktext

  // Set option to always use Hunspell instead OS spell checker.
  if (spellcheckerIsHunspell && type !== 'settings') {
    // HACK: This code doesn't do anything because `node-spellchecker` is loaded by
    // `internal/modules/cjs/loader.js` before we can set the envoriment variable here.
    // The code is additionally added to `index.ejs` to workaound the problem.
    process.env['SPELLCHECKER_PREFER_HUNSPELL'] = 1 // eslint-disable-line dot-notation
  }

  configureLogger()
}

export default bootstrapRenderer
