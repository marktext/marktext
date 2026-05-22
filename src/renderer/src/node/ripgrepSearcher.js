// Thin renderer wrapper over the main-process ripgrep IPC bridge.
// Returns a cancellable thenable with the same public shape as the legacy
// in-renderer searcher (so call sites in search.vue and quickOpen don't need
// to change).

let nextId = 1
const genId = () => `rg-${Date.now()}-${nextId++}`

const startSearch = ({ mode, directories, pattern, options }) => {
  const searchId = genId()
  const didMatch = options.didMatch || (() => {})
  const didSearchPaths = options.didSearchPaths || (() => {})

  let offMatch = null
  let offProgress = null
  let offDone = null
  let offError = null
  let offCancelled = null
  let cancelled = false

  const cleanup = () => {
    if (offMatch) offMatch()
    if (offProgress) offProgress()
    if (offDone) offDone()
    if (offError) offError()
    if (offCancelled) offCancelled()
    offMatch = offProgress = offDone = offError = offCancelled = null
  }

  const promise = new Promise((resolve, reject) => {
    offMatch = window.ripgrep.onMatch((payload) => {
      if (!payload || payload.searchId !== searchId) return
      try { didMatch(payload.payload) } catch (err) { console.error(err) }
    })
    offProgress = window.ripgrep.onProgress((payload) => {
      if (!payload || payload.searchId !== searchId) return
      try { didSearchPaths(payload.num) } catch (err) { console.error(err) }
    })
    offDone = window.ripgrep.onDone((payload) => {
      if (!payload || payload.searchId !== searchId) return
      cleanup()
      resolve()
    })
    offError = window.ripgrep.onError((payload) => {
      if (!payload || payload.searchId !== searchId) return
      cleanup()
      reject(new Error(payload.error || 'Ripgrep search failed'))
    })
    offCancelled = window.ripgrep.onCancelled((payload) => {
      if (!payload || payload.searchId !== searchId) return
      cleanup()
      resolve()
    })

    // Strip non-serializable callbacks before shipping options across IPC.
    // Pinia/Vue can hand us reactive Proxies that fail structured clone, so
    // do a JSON round-trip on the remaining options to get plain values.
    const { didMatch: _a, didSearchPaths: _b, ...rest } = options
    let serializable
    try {
      serializable = JSON.parse(JSON.stringify(rest))
    } catch {
      serializable = rest
    }
    const plainDirectories = Array.isArray(directories)
      ? directories.map((d) => String(d))
      : []
    window.ripgrep
      .start({
        searchId,
        mode,
        directories: plainDirectories,
        pattern: typeof pattern === 'string' ? pattern : String(pattern || ''),
        options: serializable
      })
      .catch((err) => {
        cleanup()
        reject(err)
      })
  })

  promise.cancel = () => {
    if (cancelled) return
    cancelled = true
    window.ripgrep.cancel(searchId)
  }
  return promise
}

class RipgrepDirectorySearcher {
  constructor() {
    this.rgPath = window.marktext?.paths?.ripgrepBinaryPath || window.rgPath || ''
  }

  search(directories, pattern, options) {
    return startSearch({ mode: 'text', directories, pattern, options })
  }
}

export default RipgrepDirectorySearcher

export class FileSearcher {
  search(directories, _pattern, options) {
    return startSearch({ mode: 'files', directories, pattern: '', options })
  }
}
