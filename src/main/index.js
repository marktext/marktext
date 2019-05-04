import './globalSetting'
import path from 'path'
import cli from './cli'
import setupExceptionHandler, { initExceptionLogger } from './exceptionHandler'
import log from 'electron-log'
import App from './app'
import Accessor from './app/accessor'
import setupEnvironment from './app/env'
import { getLogLevel } from './utils'

const initializeLogger = appEnvironment => {
  log.transports.console.level = process.env.NODE_ENV === 'development'
  log.transports.rendererConsole = null
  log.transports.file.file = path.join(appEnvironment.paths.logPath, 'main.log')
  log.transports.file.level = getLogLevel()
  log.transports.file.sync = false
  log.transports.file.init()
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

// Mark Text environment is configured successfully. You can now access paths, use the logger etc.
// Create other instances that need access to the modules from above.
const accessor = new Accessor(appEnvironment)

// -----------------------------------------------
// Be careful when changing code before this line!
// NOTE: Do not create classes or other code before this line!

const app = new App(accessor, args)
app.init()
