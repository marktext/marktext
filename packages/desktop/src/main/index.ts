import './globalSetting'
import path from 'path'
import { app, dialog, crashReporter } from 'electron'
import log from 'electron-log'
import { electronApp, optimizer } from '@electron-toolkit/utils'

import cli from './cli'
import setupExceptionHandler, { initExceptionLogger } from './exceptionHandler'
import setupEnvironment from './app/env'
import type { AppEnvironment } from './app/env'
import { getLogLevel } from './utils'
import Accessor from './app/accessor'
import App from './app'
import { t } from './i18n'
import { registerSandboxIpcHandlers } from './ipc'

// Set version strings into global and process.versions
process.env.MARKTEXT_VERSION = MARKTEXT_VERSION
process.env.MARKTEXT_VERSION_STRING = MARKTEXT_VERSION_STRING

// -----------------------------------------------
// Exception handling and logging setup
setupExceptionHandler()
const args = cli()
const appEnvironment = setupEnvironment(args as Record<string, unknown>)

const initializeLogger = (env: AppEnvironment): void => {
  log.initialize() // allows listening for logs from the renderer process
  log.transports.console.level = process.env.NODE_ENV === 'development' ? 'info' : 'error'
  log.transports.file.resolvePathFn = (variables) => {
    // electron-log's PathVariables type doesn't model the browserWindow field
    // that's available at runtime for renderer-process logs. Cast through
    // unknown to access it without weakening the rest of the variables type.
    const vars = variables as unknown as { browserWindow?: { id?: number } }
    if (vars.browserWindow && vars.browserWindow.id) {
      return path.join(env.paths.logPath, `renderer-${vars.browserWindow.id}.log`)
    }
    return path.join(env.paths.logPath, 'main.log')
  }
  log.transports.file.level = getLogLevel()
  log.transports.file.sync = true
  log.errorHandler.startCatching({
    onError(error: unknown) {
      // This callback receives the full Error object with stack
      log.error('Uncaught Exception:', (error as Error)?.stack)
    }
  })
  initExceptionLogger()
}

initializeLogger(appEnvironment)

// Handles native level crashes
crashReporter.start({
  companyName: '',
  productName: 'marktext',
  uploadToServer: false, // collect locally
  compress: true
})
process.on('uncaughtException', (err: Error) => {
  log.error('Main uncaughtException:', err.stack)
})
process.on('unhandledRejection', (reason) => {
  log.error('Main unhandledRejection:', reason)
})

// -----------------------------------------------
// Disable GPU if requested
if (args['--disable-gpu']) {
  app.disableHardwareAcceleration()
}

// Single instance lock (except macOS & development)
if (!process.mas && process.env.NODE_ENV !== 'development') {
  const gotLock = app.requestSingleInstanceLock()
  if (!gotLock) {
    process.stdout.write(t('error.otherInstanceDetected'))
    process.exit(0)
  }
}

// Register sandbox-safe IPC handlers used by the contextBridge preload
registerSandboxIpcHandlers()

// Windows-specific AppUserModelID
electronApp.setAppUserModelId('com.electron.marktext')

// Dev shortcuts and reload suppression
app.on('browser-window-created', (_, window) => {
  optimizer.watchWindowShortcuts(window)
})

// Instantiate and start the main App controller
let accessor: Accessor
try {
  accessor = new Accessor(appEnvironment)
} catch (err) {
  const errorObj = err instanceof Error ? err : new Error(String(err))
  const msgHint = errorObj.message.includes('Config schema violation')
    ? t('error.configSchemaViolation')
    : ''
  log.error(t('error.initializationFailed', { hint: msgHint }), errorObj)

  const EXIT_ON_ERROR = !!process.env.MARKTEXT_EXIT_ON_ERROR
  const SHOW_ERROR_DIALOG = !process.env.MARKTEXT_ERROR_INTERACTION
  if (!EXIT_ON_ERROR && SHOW_ERROR_DIALOG) {
    dialog.showErrorBox(
      t('error.startupError'),
      `${msgHint}${errorObj.message}\n\n${errorObj.stack ?? ''}`
    )
  }
  process.exit(1)
}
const appController = new App(accessor, args as unknown as { _: string[] })
appController.init()

// Quit when all windows are closed (except on macOS)
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
