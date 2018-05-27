// CodeMirror, copyright (c) by Marijn Haverbeke and others
// Distributed under an MIT license: https://codemirror.net/LICENSE

const loadMore = CodeMirror => {
  if (!CodeMirror.modeURL) {
    CodeMirror.modeURL = '../../mode/%N/%N.js'
  }

  const loading = {}
  function splitCallback (cont, n) {
    let countDown = n
    return function () { if (--countDown === 0) cont() }
  }
  function ensureDeps (mode, cont) {
    const deps = CodeMirror.modes[mode].dependencies
    if (!deps) return cont()
    const missing = []
    for (let i = 0; i < deps.length; ++i) {
      if (!CodeMirror.modes.hasOwnProperty(deps[i])) {
        missing.push(deps[i])
      }
    }
    if (!missing.length) return cont()
    const split = splitCallback(cont, missing.length)
    for (let i = 0; i < missing.length; ++i) {
      CodeMirror.requireMode(missing[i], split)
    }
  }

  CodeMirror.requireMode = function (mode, cont) {
    if (typeof mode !== 'string') {
      mode = mode.name
    }
    if (CodeMirror.modes.hasOwnProperty(mode)) return ensureDeps(mode, cont)
    if (loading.hasOwnProperty(mode)) return loading[mode].push(cont)

    const file = CodeMirror.modeURL.replace(/%N/g, mode)
    const script = document.createElement('script')
    script.src = file
    const others = document.getElementsByTagName('script')[0]
    const list = loading[mode] = [cont]
    CodeMirror.on(script, 'load', function () {
      ensureDeps(mode, function () {
        for (let i = 0; i < list.length; ++i) {
          list[i]()
        }
      })
    })
    others.parentNode.insertBefore(script, others)
  }

  CodeMirror.autoLoadMode = function (instance, mode) {
    if (!CodeMirror.modes.hasOwnProperty(mode)) {
      CodeMirror.requireMode(mode, function () {
        instance.setOption('mode', instance.getOption('mode'))
      })
    }
  }
}
export default loadMore
