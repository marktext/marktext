// CodeMirror, copyright (c) by Marijn Haverbeke and others
// Distributed under an MIT license: https://codemirror.net/LICENSE

const codeMirrorMode = import.meta.glob('../../../../node_modules/codemirror/mode/**/*.js')

const loadMore = (CodeMirror) => {
  if (!CodeMirror.modeURL) {
    CodeMirror.modeURL = '../../../../node_modules/codemirror/mode/%N/%N.js'
  }

  const loading = {}
  function splitCallback(cont, n) {
    let countDown = n
    return function() {
      if (--countDown === 0) cont()
    }
  }
  function ensureDeps(mode, cont) {
    const deps = CodeMirror.modes[mode].dependencies
    if (!deps) return cont()
    const missing = []
    for (let i = 0; i < deps.length; ++i) {
      if (!Object.prototype.hasOwnProperty.call(CodeMirror.modes, deps[i])) {
        missing.push(deps[i])
      }
    }
    if (!missing.length) return cont()
    const split = splitCallback(cont, missing.length)
    for (let i = 0; i < missing.length; ++i) {
      CodeMirror.requireMode(missing[i], split)
    }
  }

  CodeMirror.requireMode = function(mode, cont) {
    if (typeof mode !== 'string') {
      mode = mode.name
    }
    if (Object.prototype.hasOwnProperty.call(CodeMirror.modes, mode)) return ensureDeps(mode, cont)
    if (Object.prototype.hasOwnProperty.call(loading, mode)) return loading[mode].push(cont)

    const list = (loading[mode] = [cont])

    const pathKey = CodeMirror.modeURL.replace(/%N/g, mode)

    if (!pathKey) {
      delete loading[mode]
      console.error(`Cannot find path for CodeMirror mode ${mode}`)
      return
    }

    const loader = codeMirrorMode[pathKey]
    if (typeof loader !== 'function') {
      delete loading[mode]
      console.error(`Invalid loader for CodeMirror mode ${mode}`)
      return
    }

    loader()
      .then(() => {
        ensureDeps(mode, function() {
          for (let i = 0; i < list.length; ++i) {
            list[i]()
          }
        })
      })
      .catch((err) => {
        console.error(`Failed to load CodeMirror mode "${mode}"`, err)
      })
  }

  CodeMirror.autoLoadMode = function(instance, mode) {
    if (!Object.prototype.hasOwnProperty.call(CodeMirror.modes, mode)) {
      CodeMirror.requireMode(mode, function() {
        instance.setOption('mode', instance.getOption('mode'))
      })
    }
  }
}
export default loadMore
