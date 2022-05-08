import './globalSetting'
import path from 'path'
import { app, dialog } from 'electron'
import { initialize as remoteInitializeServer } from '@electron/remote/main'
import cli from './cli'
import setupExceptionHandler, { initExceptionLogger } from './exceptionHandler'
import log from 'electron-log'
import App from './app'
import Accessor from './app/accessor'
import setupEnvironment from './app/env'
import { getLogLevel } from './utils'

const initializeLogger = appEnvironment => {
  log.transports.console.level = process.env.NODE_ENV === 'development' ? 'info' : 'error'
  log.transports.rendererConsole = null
  log.transports.file.resolvePath = () => path.join(appEnvironment.paths.logPath, 'main.log')
  log.transports.file.level = getLogLevel()
  log.transports.file.sync = true
  initExceptionLogger()
}

// -----------------------------------------------

// NOTE: We only support Linux, macOS and Windows but not BSD nor SunOS.
if (!/^(darwin|win32|linux)$/i.test(process.platform)) {
  process.stdout.write(`Operating system "${process.platform}" is not supported! Please open an issue at "https://github.com/marktext/marktext".\n`)
  process.exit(1)
}

setupExceptionHandler()

const args = cli()
const appEnvironment = setupEnvironment(args)
initializeLogger(appEnvironment)

if (args['--disable-gpu']) {
  app.disableHardwareAcceleration()
}

// Make MarkText a single instance application.
if (!process.mas && process.env.NODE_ENV !== 'development') {
  const gotSingleInstanceLock = app.requestSingleInstanceLock()
  if (!gotSingleInstanceLock) {
    process.stdout.write('Other MarkText instance detected: exiting...\n')
    app.exit()
  }
}

// MarkText environment is configured successfully. You can now access paths, use the logger etc.
// Create other instances that need access to the modules from above.
let accessor = null
try {
  accessor = new Accessor(appEnvironment)
} catch (err) {
  // Catch errors that may come from invalid configuration files like settings.
  const msgHint = err.message.includes('Config schema violation')
    ? 'This seems to be an issue with your configuration file(s). '
    : ''
  log.error(`Loading MarkText failed during initialization! ${msgHint}`, err)

  const EXIT_ON_ERROR = !!process.env.MARKTEXT_EXIT_ON_ERROR
  const SHOW_ERROR_DIALOG = !process.env.MARKTEXT_ERROR_INTERACTION
  if (!EXIT_ON_ERROR && SHOW_ERROR_DIALOG) {
    dialog.showErrorBox(
      'There was an error during loading',
      `${msgHint}${err.message}\n\n${err.stack}`
    )
  }
  process.exit(1)
}

// Use synchronous only to report errors in early stage of startup.
log.transports.file.sync = false

// -----------------------------------------------
// Be careful when changing code before this line!
// NOTE: Do not create classes or other code before this line!

// TODO: We should switch to another async API like https://nornagon.medium.com/electrons-remote-module-considered-harmful-70d69500f31.
// Enable remote module
remoteInitializeServer()

const marktext = new App(accessor, args)
marktext.init()
