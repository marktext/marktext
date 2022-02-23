// Based on electron-unhandled by sindresorhus:
//
// MIT License
// Copyright (c) Sindre Sorhus <sindresorhus@gmail.com> (sindresorhus.com)
// Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
// The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

import { app, clipboard, crashReporter, dialog, ipcMain } from 'electron'
import os from 'os'
import log from 'electron-log'
import { createAndOpenGitHubIssueUrl } from './utils/createGitHubIssue'

const EXIT_ON_ERROR = !!process.env.MARKTEXT_EXIT_ON_ERROR
const SHOW_ERROR_DIALOG = !process.env.MARKTEXT_ERROR_INTERACTION
const ERROR_MSG_MAIN = 'An unexpected error occurred in the main process'
const ERROR_MSG_RENDERER = 'An unexpected error occurred in the renderer process'

let logger = s => console.error(s)

const getOSInformation = () => {
  return `${os.type()} ${os.arch()} ${os.release()} (${os.platform()})`
}

const exceptionToString = (error, type) => {
  const { message, stack } = error
  return `Version: ${global.MARKTEXT_VERSION_STRING || app.getVersion()}\n` +
    `OS: ${getOSInformation()}\n` +
    `Type: ${type}\n` +
    `Date: ${new Date().toUTCString()}\n` +
    `Message: ${message}\n` +
    `Stack: ${stack}\n`
}

const handleError = async (title, error, type) => {
  const { message, stack } = error

  // Write error into file
  if (type === 'main') {
    logger(exceptionToString(error, type))
  }

  if (EXIT_ON_ERROR) {
    console.log('MarkText was terminated due to an unexpected error (MARKTEXT_EXIT_ON_ERROR variable was set)!')
    process.exit(1)
    // eslint, don't lie to me, the return statement is important!
    return // eslint-disable-line no-unreachable
  } else if (!SHOW_ERROR_DIALOG || (global.MARKTEXT_IS_STABLE && type === 'renderer')) {
    return
  }

  // show error dialog
  if (app.isReady()) {
    // Blocking message box
    const { response } = await dialog.showMessageBox({
      type: 'error',
      buttons: [
        'OK',
        'Copy Error',
        'Report...'
      ],
      defaultId: 0,
      noLink: true,
      message: title,
      detail: stack
    })

    switch (response) {
      case 1: {
        clipboard.writeText(`${title}\n${stack}`)
        break
      }
      case 2: {
        const issueTitle = message ? `Unexpected error: ${message}` : title
        createAndOpenGitHubIssueUrl(
          issueTitle,
          `### Description

${title}.

<!-- Please describe, how the bug occurred -->

### Stack Trace

\`\`\`\n${stack}\n\`\`\`

### Version

MarkText: ${global.MARKTEXT_VERSION_STRING}
Operating system: ${getOSInformation()}`)
        break
      }
    }
  } else {
    // error during Electron initialization
    dialog.showErrorBox(title, stack)
    process.exit(1)
  }
}

const setupExceptionHandler = () => {
  // main process error handler
  process.on('uncaughtException', error => {
    handleError(ERROR_MSG_MAIN, error, 'main')
  })

  // renderer process error handler
  ipcMain.on('mt::handle-renderer-error', (e, error) => {
    handleError(ERROR_MSG_RENDERER, error, 'renderer')
  })

  // start crashReporter to save core dumps to temporary folder
  crashReporter.start({
    companyName: 'marktext',
    productName: 'marktext',
    submitURL: 'http://0.0.0.0/',
    uploadToServer: false,
    compress: true
  })
}

export const initExceptionLogger = () => {
  // replace placeholder logger
  logger = log.error
}

export default setupExceptionHandler
