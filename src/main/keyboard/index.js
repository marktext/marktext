// import EventEmitter from 'events'
import { getCurrentKeyboardLayout, getCurrentKeyboardLanguage, getCurrentKeymap } from 'keyboard-layout'

export const getKeyboardLanguage = () => {
  const lang = getCurrentKeyboardLanguage()
  if (lang.length >= 2) {
    return lang.substring(0, 2)
  }
  return lang
}

export const dumpKeyboardInformation = () => {
  return `Layout: ${getCurrentKeyboardLayout()}\n` +
    `Language: ${getCurrentKeyboardLanguage()}\n\n` +
    JSON.stringify(getCurrentKeymap(), null, 2)
}

export const getVirtualLetters = () => {
  // Full list of supported virtual keys:
  // https://github.com/parro-it/keyboardevent-from-electron-accelerator/blob/afdbd57bead1e139d7bd03c763778dce6ca8c35d/main.js#L104
  const currentKeymap = getCurrentKeymap()
  const vkeys = {}
  for (const key in currentKeymap) {
    // TODO(fxha): Possibly, we can fix more broken accelerators without apply a manually fix later.
    if (!key.startsWith('Key')) {
      continue
    }
    const unmodifiedKey = currentKeymap[key].unmodified
    if (unmodifiedKey) {
      // uppercase character / vkey name (A: KeyA)
      vkeys[unmodifiedKey.toUpperCase()] = key
    }
  }
  return vkeys
}

// class KeyboardLayoutMonitor {
//
//   constructor() {
//     this._eventEmitter = new EventEmitter()
//     this._subscription = null
//   }
//
//   onDidChangeCurrentKeyboardLayout (callback) {
//     if (!this._subscription) {
//       this._subscription = onDidChangeCurrentKeyboardLayout(layout => {
//         this._eventEmitter.emit('onDidChangeCurrentKeyboardLayout', layout)
//       })
//     }
//     this._eventEmitter.on('onDidChangeCurrentKeyboardLayout', callback)
//   }
//
// }
//
// // TODO(@fxha): Reload ShortcutHandler on change
// export const keyboardLayoutMonitor = new KeyboardLayoutMonitor()
