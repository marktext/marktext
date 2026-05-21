import log from 'electron-log/renderer'
import RendererPaths from './node/paths'

let exceptionLogger = (s) => console.error(s)

const configureLogger = () => {
  const isDev = window.electron?.process?.env?.NODE_ENV === 'development'
  log.transports.console.level = isDev ? 'info' : false // mirror to window console
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
    }
  }
}

/**
 * Check if an error is a known non-fatal CodeMirror race condition.
 * These errors occur when clicking in the editor during rapid state changes
 * and don't affect functionality - the user can simply click again.
 *
 * @param {Error} error - The error to check
 * @returns {boolean} True if this is a suppressible CodeMirror error
 */
const isCodeMirrorRaceCondition = (error) => {
  if (!error || !error.stack) return false

  // CodeMirror internal error when line measurement data is unavailable during mouse click
  // This happens when the document state is out of sync with the display during rapid changes
  const isMapOnUndefined =
    error.message === "Cannot read properties of undefined (reading 'map')"
  const isInPrepareMeasure = error.stack.includes('prepareMeasureForLine')
  const isInCoordsChar =
    error.stack.includes('coordsChar') || error.stack.includes('posFromMouse')

  return isMapOnUndefined && isInPrepareMeasure && isInCoordsChar
}

const handleRendererError = (event) => {
  if (event.error) {
    // Suppress known non-fatal CodeMirror race conditions
    // These occur during rapid clicking/editing and don't affect functionality
    if (isCodeMirrorRaceCondition(event.error)) {
      console.warn('Suppressed non-fatal CodeMirror race condition:', event.error.message)
      return
    }

    const { message, name, stack } = event.error
    const copy = {
      message,
      name,
      stack
    }

    exceptionLogger(event.error)

    // Pass exception to main process exception handler to show a error dialog.
    window.electron.ipcRenderer.send('mt::handle-renderer-error', copy)
  } else {
    console.error(event)
  }
}

const bootstrapRenderer = () => {
  // Register renderer exception handler
  window.addEventListener('error', handleRendererError)
  window.addEventListener('unhandledrejection', handleRendererError)

  const { debug, initialState, userDataPath, windowId, type } = parseUrlArgs()
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
  // `global` is not available in a sandboxed renderer — attach to window.
  window.marktext = marktext

  configureLogger()
}

export default bootstrapRenderer
