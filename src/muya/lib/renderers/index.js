const rendererCache = new Map()

const log = (msg) => {
  const line = `[${new Date().toISOString()}] [LOADER] ${msg}\n`
  try {
    const fs = require('fs')
    fs.appendFileSync('/tmp/mermaid-debug.log', line)
  } catch (e) {}
  console.log('[MERMAID LOADER]', msg)
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
          m = await import('mermaid')
          log(`mermaid imported, m keys: ${Object.keys(m).join(',')}`)
          log(`m.default type: ${typeof m.default}`)
          if (m.default) {
            log(`m.default keys: ${Object.keys(m.default).join(',')}`)
          }
          rendererCache.set(name, m.default)
        } catch (err) {
          log(`Failed to import mermaid: ${err.message}\n${err.stack}`)
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
