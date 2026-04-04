const fs = require('fs')
const path = require('path')
const logFile = path.join(process.env.HOME || '/tmp', 'marktext-mermaid-debug.log')

const writeLog = (msg) => {
  const timestamp = new Date().toISOString()
  const line = `[${timestamp}] ${msg}\n`
  try {
    fs.appendFileSync(logFile, line)
  } catch (e) {
    // ignore
  }
}

const rendererCache = new Map()
/**
 *
 * @param {string} name the renderer name: katex, sequence, plantuml, flowchart, mermaid, vega-lite
 */
const loadRenderer = async (name) => {
  if (!rendererCache.has(name)) {
    writeLog('loadRenderer: importing ' + name)
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
        m = await import('mermaid/dist/mermaid.esm.mjs')
        writeLog('loadRenderer: mermaid imported, m keys: ' + Object.keys(m).join(', '))
        writeLog('loadRenderer: m.default type: ' + typeof m.default)
        if (m.default) {
          writeLog('loadRenderer: m.default keys: ' + Object.keys(m.default).join(', '))
        }
        rendererCache.set(name, m.default)
        break
      case 'vega-lite':
        m = await import('vega-embed')
        rendererCache.set(name, m.default)
        break
      default:
        throw new Error(`Unknown diagram name ${name}`)
    }
    writeLog('loadRenderer: ' + name + ' cached')
  }

  const result = rendererCache.get(name)
  writeLog('loadRenderer: returning ' + name + ', type: ' + typeof result)
  return result
}

export default loadRenderer
