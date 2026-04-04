const rendererCache = new Map()

const log = (msg) => {
  const line = `[${new Date().toISOString()}] [LOADER] ${msg}\n`
  try {
    const fs = require('fs')
    fs.appendFileSync('/tmp/mermaid-debug.log', line)
  } catch (e) {}
  console.log('[MERMAID LOADER]', msg)
}

const loadMermaidRuntime = () => {
  return new Promise((resolve, reject) => {
    if (globalThis.mermaid && typeof globalThis.mermaid.initialize === 'function') {
      log('Using existing global mermaid')
      resolve(globalThis.mermaid)
      return
    }

    const mermaidPath = require.resolve('mermaid/dist/mermaid.min.js')
    log(`Loading mermaid from: ${mermaidPath}`)

    const script = document.createElement('script')
    script.src = `file://${mermaidPath}`
    log(`Script src: ${script.src}`)
    script.onload = () => {
      log(`Script loaded, globalThis.mermaid type: ${typeof globalThis.mermaid}`)
      if (globalThis.mermaid && typeof globalThis.mermaid.initialize === 'function') {
        resolve(globalThis.mermaid)
      } else {
        reject(new Error('mermaid not found on globalThis after script load'))
      }
    }
    script.onerror = (e) => reject(new Error('Failed to load mermaid script'))
    document.head.appendChild(script)
  })
}

const loadRenderer = async (name) => {
  if (!rendererCache.has(name)) {
    log(`Loading ${name}...`)
    let m
    switch (name) {
      case 'sequence':
        m = await import('../parser/render/sequence')
        rendererCache.set(name, m.default)
        break
      case 'plantuml':
        m = await import('../parser/render/plantuml')
        rendererCache.set(name, m.default)
        break
      case 'flowchart':
        m = await import('flowchart.js')
        rendererCache.set(name, m.default)
        break
      case 'mermaid':
        try {
          m = await loadMermaidRuntime()
          log(`mermaid loaded, type=${typeof m}`)
          if (m) {
            log(`m keys: ${Object.keys(m).join(',')}`)
          }
          rendererCache.set(name, m)
        } catch (err) {
          log(`Failed to load mermaid: ${err.message}\n${err.stack}`)
          throw err
        }
        break
      case 'vega-lite':
        m = await import('vega-embed')
        rendererCache.set(name, m.default)
        break
      default:
        throw new Error(`Unknown diagram name ${name}`)
    }
    log(`${name} cached`)
  }

  const result = rendererCache.get(name)
  log(`Returning ${name}, type=${typeof result}`)
  return result
}

export default loadRenderer
