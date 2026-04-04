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

    const path = require('path')
    const fs = require('fs')

    let mermaidPath
    try {
      const devPath = path.join(__dirname, '../../../../node_modules/mermaid/dist/mermaid.min.js')
      if (fs.existsSync(devPath)) {
        mermaidPath = devPath
      } else {
        const prodPath = path.join(process.resourcesPath, 'app.asar', 'node_modules', 'mermaid', 'dist', 'mermaid.min.js')
        if (fs.existsSync(prodPath)) {
          mermaidPath = prodPath
        }
      }
    } catch (e) {}

    if (!mermaidPath) {
      reject(new Error('Could not find mermaid.min.js'))
      return
    }

    log(`Reading mermaid from: ${mermaidPath}`)

    try {
      const mermaidCode = fs.readFileSync(mermaidPath, 'utf-8')
      log(`Mermaid code length: ${mermaidCode.length}`)
      const blob = new Blob([mermaidCode], { type: 'application/javascript' })
      const url = URL.createObjectURL(blob)
      log(`Blob URL created: ${url}`)

      const script = document.createElement('script')
      script.src = url
      script.onload = () => {
        URL.revokeObjectURL(url)
        log(`Script executed, globalThis.mermaid type: ${typeof globalThis.mermaid}`)
        if (globalThis.mermaid && typeof globalThis.mermaid.initialize === 'function') {
          resolve(globalThis.mermaid)
        } else {
          reject(new Error('mermaid not found on globalThis'))
        }
      }
      script.onerror = () => reject(new Error('Failed to execute mermaid script'))
      document.head.appendChild(script)
    } catch (err) {
      reject(new Error(`Failed to read mermaid file: ${err.message}`))
    }
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
