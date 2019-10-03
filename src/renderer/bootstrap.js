import path from 'path'
import { crashReporter, ipcRenderer } from 'electron'
import log from 'electron-log'
import RendererPaths from './node/paths'

let exceptionLogger = s => console.error(s)

const configureLogger = () => {
  const { debug, paths, windowId } = global.marktext.env
  log.transports.console.level = process.env.NODE_ENV === 'development' // mirror to window console
  log.transports.mainConsole = null
  log.transports.file.file = path.join(paths.logPath, `editor-${windowId}.log`)
  log.transports.file.level = debug ? 'debug' : 'info'
  log.transports.file.sync = false
  log.transports.file.init()
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

const bootstrapRenderer = () => {
  // Start crash reporter to save core dumps for the renderer process
  crashReporter.start({
    companyName: 'marktext',
    productName: 'marktext',
    submitURL: 'http://0.0.0.0/',
    uploadToServer: false
  })

  // Register renderer exception handler
  window.addEventListener('error', event => {
    const { message, name, stack } = event.error
    const copy = {
      message,
      name,
      stack
    }

    exceptionLogger(event.error)

    // Pass exception to main process exception handler to show a error dialog.
    ipcRenderer.send('AGANI::handle-renderer-error', copy)
  })

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
  global.marktext = marktext

  configureLogger()
}

export default bootstrapRenderer
