export async function renderDiagram(
  target: HTMLElement,
  language: string,
  source: string,
  id: string,
  dark: boolean
): Promise<() => void> {
  let dispose = () => {}
  if (language === 'mermaid') {
    const { default: mermaid } = await import('mermaid')
    mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', theme: dark ? 'dark' : 'default', suppressErrorRendering: true })
    const { svg } = await mermaid.render(id, source)
    target.innerHTML = svg
  } else if (language === 'vega-lite') {
    const { default: embed } = await import('vega-embed')
    const result = await embed(target, JSON.parse(source), {
      mode: 'vega-lite', renderer: 'svg', actions: false, tooltip: false,
      theme: dark ? 'dark' : 'latimes'
    })
    dispose = () => result.finalize()
  } else if (language === 'flowchart') {
    const { default: flowchart } = await import('flowchart.js')
    const chart = flowchart.parse(source)
    chart.drawSVG(target)
    dispose = () => chart.clean()
  } else if (language === 'sequence') {
    // The npm name is a security placeholder; use the BSD renderer already
    // vendored by the editor instead of installing that package.
    const { default: sequence } = await import('../../../muya/src/utils/diagram/sequence/sequence-diagram-snap')
    sequence.parse(source).drawSVG(target, { theme: 'simple' })
  } else if (language === 'plantuml') {
    const { default: encoder } = await import('plantuml-encoder')
    const image = new Image()
    image.alt = 'PlantUML diagram'
    await new Promise<void>((resolve, reject) => {
      const timer = window.setTimeout(() => {
        image.removeAttribute('src')
        reject(new Error('PlantUML image timed out'))
      }, 15000)
      image.onload = () => {
        window.clearTimeout(timer)
        resolve()
      }
      image.onerror = () => {
        window.clearTimeout(timer)
        reject(new Error('PlantUML image failed to load'))
      }
      image.src = `https://www.plantuml.com/plantuml/svg/${encoder.encode(source)}`
      target.appendChild(image)
    })
  } else {
    throw new Error(`Unsupported diagram language: ${language}`)
  }

  // Legacy SVG renderers finish after font loading and emit only fixed sizes.
  // A viewBox keeps those diagrams usable within narrow documentation columns.
  function sizeSvg() {
    const svg = target.querySelector('svg')
    if (!svg || svg.hasAttribute('viewBox')) return
    const width = Number.parseFloat(svg.getAttribute('width') ?? '')
    const height = Number.parseFloat(svg.getAttribute('height') ?? '')
    if (width > 0 && height > 0) svg.setAttribute('viewBox', `0 0 ${width} ${height}`)
  }
  sizeSvg()
  const observer = new MutationObserver(sizeSvg)
  observer.observe(target, { childList: true, subtree: true, attributes: true, attributeFilter: ['width', 'height'] })
  target.setAttribute('role', 'img')
  target.setAttribute('aria-label', `${language} diagram`)
  return () => {
    observer.disconnect()
    dispose()
  }
}
