import { renderDiagramForExport } from '@muyajs/core'

export type ExportFormat = 'svg' | 'png'

export interface DiagramThemes {
  mermaidTheme: string
  vegaTheme: string
  plantumlServer: string
  sequenceTheme: 'hand' | 'simple'
}

export interface DiagramSource extends DiagramThemes {
  type: string
  code: string
  preview: HTMLElement
}

export interface ExportedImage {
  data: Uint8Array
  mime: string
  extension: ExportFormat
}

const PNG_SCALE = 2
const MAX_PIXELS = 4e7

// Raphael (flowchart.js) and Snap (js-sequence-diagrams) leave their text
// uncoloured and let the editor's stylesheet do it, so a standalone copy of
// their output would come out black on whatever background it lands on.
// Mermaid and Vega-Lite carry their own styling and need none of this.
const NEEDS_INLINE_STYLES = new Set(['flowchart', 'sequence'])
const INLINED_PROPERTIES = [
  'fill',
  'fill-opacity',
  'stroke',
  'stroke-width',
  'stroke-opacity',
  'stroke-dasharray',
  'color',
  'font-family',
  'font-size',
  'font-weight',
  'font-style',
  'text-anchor'
]
const MAX_STYLED_ELEMENTS = 5000

const PLANTUML_SRC = /^(https?:\/\/.+?)\/(?:svg|png|txt)\/([A-Za-z0-9_-]+)$/

export const splitPlantumlSrc = (src: string): { server: string; encoded: string } | null => {
  const match = PLANTUML_SRC.exec(src)
  return match ? { server: match[1], encoded: match[2] } : null
}

const inlineComputedStyles = (live: Element, clone: Element): void => {
  const liveNodes = [live, ...live.querySelectorAll('*')]
  const cloneNodes = [clone, ...clone.querySelectorAll('*')]
  if (liveNodes.length !== cloneNodes.length || liveNodes.length > MAX_STYLED_ELEMENTS) return

  for (let i = 0; i < liveNodes.length; i++) {
    const computed = getComputedStyle(liveNodes[i])
    const declarations = INLINED_PROPERTIES.map(
      (property) => [property, computed.getPropertyValue(property)] as const
    )
      .filter(([, value]) => value)
      .map(([property, value]) => `${property}:${value}`)
      .join(';')

    if (!declarations) continue

    const target = cloneNodes[i]
    const existing = target.getAttribute('style')?.replace(/;\s*$/, '')
    target.setAttribute('style', existing ? `${existing};${declarations}` : declarations)
  }
}

export interface SerializedSvg {
  markup: string
  width: number
  height: number
}

/**
 * The size a diagram was drawn at, which is what its `viewBox` records — the
 * laid-out size is whatever the editor column happened to squeeze it into.
 */
export const naturalSvgSize = (svg: SVGSVGElement): { width: number; height: number } => {
  const box = svg.viewBox?.baseVal
  const rect = svg.getBoundingClientRect()

  return {
    width: Math.max(1, Math.round(box?.width || rect.width)),
    height: Math.max(1, Math.round(box?.height || rect.height))
  }
}

export interface SerializeOptions {
  inlineStyles: boolean
  /** Painted behind the drawing, since an exported file has no editor under it. */
  background: string
}

export const serializeSvg = (svg: SVGSVGElement, options: SerializeOptions): SerializedSvg => {
  const { width, height } = naturalSvgSize(svg)

  const clone = svg.cloneNode(true) as SVGSVGElement
  // Before anything is added to the clone: the walk pairs the two trees up by
  // position and gives up if their shapes differ.
  if (options.inlineStyles) inlineComputedStyles(svg, clone)

  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
  clone.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink')
  clone.setAttribute('width', String(width))
  clone.setAttribute('height', String(height))
  if (!clone.getAttribute('viewBox')) clone.setAttribute('viewBox', `0 0 ${width} ${height}`)
  // Mermaid caps its root at the width it was measured in; a standalone file
  // has no such container.
  clone.style.removeProperty('max-width')

  // A dark theme draws pale strokes and pale text. On the transparent canvas an
  // svg defaults to, that is invisible wherever the file is opened.
  const box = svg.viewBox?.baseVal
  const backdrop = document.createElementNS('http://www.w3.org/2000/svg', 'rect')
  backdrop.setAttribute('x', String(Math.floor(box?.x ?? 0)))
  backdrop.setAttribute('y', String(Math.floor(box?.y ?? 0)))
  backdrop.setAttribute('width', String(width))
  backdrop.setAttribute('height', String(height))
  // Inline, so a stylesheet the renderer embedded cannot repaint it.
  backdrop.setAttribute('style', `fill:${options.background}`)
  clone.insertBefore(backdrop, clone.firstChild)

  const markup = `<?xml version="1.0" encoding="UTF-8"?>\n${new XMLSerializer().serializeToString(clone)}`

  return { markup, width, height }
}

const toBytes = (text: string): Uint8Array => new TextEncoder().encode(text)

const loadSvgImage = (markup: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('The diagram could not be read back as an image'))
    // A `blob:` URL would be blocked: the renderer's CSP lists `data:` and
    // `file:` under img-src, and `*` matches neither scheme.
    image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`
  })

const rasterize = async(svg: SerializedSvg, background: string): Promise<Uint8Array> => {
  const scale = Math.min(PNG_SCALE, Math.sqrt(MAX_PIXELS / (svg.width * svg.height)))
  const image = await loadSvgImage(svg.markup)

  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(svg.width * scale))
  canvas.height = Math.max(1, Math.round(svg.height * scale))

  const context = canvas.getContext('2d')
  if (!context) throw new Error('The diagram could not be rasterised')

  context.fillStyle = background
  context.fillRect(0, 0, canvas.width, canvas.height)
  context.drawImage(image, 0, 0, canvas.width, canvas.height)

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
  if (!blob) throw new Error('The diagram could not be rasterised')

  return new Uint8Array(await blob.arrayBuffer())
}

// Mermaid puts node labels in a `<foreignObject>`, which only a browser will
// paint. Re-render the same code with plain `<text>` labels.
const serializeWithoutHtmlLabels = async(
  source: DiagramSource,
  options: SerializeOptions
): Promise<SerializedSvg> => {
  const host = document.createElement('figure')
  host.className = 'mu-diagram-block'
  host.setAttribute('aria-hidden', 'true')
  host.style.cssText = 'position:fixed;left:-99999px;top:0'
  const target = document.createElement('div')
  target.className = 'mu-diagram-preview'
  host.appendChild(target)
  document.body.appendChild(host)

  try {
    await renderDiagramForExport({
      type: source.type,
      code: source.code,
      target,
      htmlLabels: false,
      mermaidTheme: source.mermaidTheme,
      vegaTheme: source.vegaTheme,
      plantumlServer: source.plantumlServer,
      sequenceTheme: source.sequenceTheme
    })

    const svg = target.querySelector('svg')
    if (!svg) throw new Error('The diagram could not be re-rendered for export')

    // While it is still in the document: a detached node measures as nothing
    // and has no computed style to read.
    return serializeSvg(svg, options)
  } finally {
    host.remove()
  }
}

const exportPlantuml = async(source: DiagramSource, format: ExportFormat): Promise<ExportedImage> => {
  const img = source.preview.querySelector('img')
  const parts = img?.src ? splitPlantumlSrc(img.src) : null
  if (!parts) throw new Error('The PlantUML diagram has no render URL')

  const result = await window.diagram.fetchPlantuml(parts.server, parts.encoded, format)
  if (!result.ok) throw new Error(result.error)

  return { data: result.data, mime: result.mime, extension: format }
}

export const exportDiagram = async(
  source: DiagramSource,
  format: ExportFormat,
  background: string
): Promise<ExportedImage> => {
  if (source.type === 'plantuml') return exportPlantuml(source, format)

  const live = source.preview.querySelector('svg')
  if (!live) throw new Error('The diagram has not rendered')

  const options = { inlineStyles: NEEDS_INLINE_STYLES.has(source.type), background }
  const svg =
    source.type === 'mermaid'
      ? await serializeWithoutHtmlLabels(source, options)
      : serializeSvg(live, options)

  if (format === 'svg') {
    return { data: toBytes(svg.markup), mime: 'image/svg+xml', extension: 'svg' }
  }

  return { data: await rasterize(svg, background), mime: 'image/png', extension: 'png' }
}
