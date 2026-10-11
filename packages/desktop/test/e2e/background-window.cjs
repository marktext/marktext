// Loaded with `-r` when MARKTEXT_E2E_BACKGROUND=1 (see helpers.ts): every
// window opens off screen, outside the taskbar and without taking focus, so a
// local run does not interrupt the person at the computer. Rendering is
// unaffected: the launch flags disable occlusion throttling.
//
// `electron` cannot be required while this preload runs, and its exports are
// non-configurable getters, so the app's first `require('electron')` is
// answered with a proxy. Instances are still created by the real class:
// `BrowserWindow.getAllWindows()` only lists windows it constructed itself.
if (process.type === 'browser') {
  const Module = require('node:module')
  const load = Module._load
  const OFFSCREEN = { x: -20000, y: 0 }
  const proxies = new WeakMap()
  let BackgroundWindow

  const patchPrototype = (BrowserWindow) => {
    const proto = BrowserWindow.prototype
    const { showInactive, setBounds } = proto
    proto.show = function () {
      showInactive.call(this)
    }
    for (const name of ['focus', 'moveTop', 'maximize', 'setPosition', 'center']) {
      proto[name] = function () {}
    }
    proto.setBounds = function (bounds, animate) {
      setBounds.call(this, { ...bounds, ...OFFSCREEN }, animate)
    }
  }

  Module._load = function (request) {
    const exports = load.apply(this, arguments)
    if (request !== 'electron' && request !== 'electron/main') return exports
    if (!BackgroundWindow) {
      const Original = exports.BrowserWindow
      patchPrototype(Original)
      BackgroundWindow = new Proxy(Original, {
        construct (target, [options = {}], newTarget) {
          const win = Reflect.construct(
            target,
            [{ ...options, ...OFFSCREEN, show: false, skipTaskbar: true }],
            newTarget === BackgroundWindow ? target : newTarget
          )
          if (options.show !== false) win.showInactive()
          return win
        }
      })
    }
    if (!proxies.has(exports)) {
      proxies.set(exports, new Proxy(exports, {
        get: (target, key) => (key === 'BrowserWindow' ? BackgroundWindow : Reflect.get(target, key))
      }))
    }
    return proxies.get(exports)
  }
}
