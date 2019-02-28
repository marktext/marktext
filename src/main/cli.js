import { dumpKeyboardInformation } from './keyboardUtils'

for (const arg of process.argv) {
  if (arg === '--dump-keyboard-layout') {
    console.log(dumpKeyboardInformation())
    process.exit(0)
  } else if (arg === '--debug') {
    global.MARKTEXT_DEBUG = true
    continue
  } else if (arg === '--safe') {
    global.MARKTEXT_SAFE_MODE = true
    continue
  } else if (arg === '--version') {
    console.log(`Mark Text: ${global.MARKTEXT_VERSION_STRING}
Node.js: ${process.versions.node}
Electron: ${process.versions.electron}
Chromium: ${process.versions.chrome}
    `)
    process.exit(0)
  } else if (arg === '--help') {
    console.log(`Usage: marktext [commands] [path]

Available commands:

  --debug                     Enable debug mode
  --safe                      Disable plugins and other user configuration
  --dump-keyboard-layout      Dump keyboard information
  --version                   Print version information
  --help                      Print this help message
    `)
    process.exit(0)
  }
}
