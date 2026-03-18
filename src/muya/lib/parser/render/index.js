import loadRenderer from '../../renderers'
import { CLASS_OR_ID } from '../../config'
import { conflict, mixins, camelToSnake } from '../../utils'
import { patch, toVNode, toHTML, h } from './snabbdom'
import { beginRules } from '../rules'
import renderInlines from './renderInlines'
import renderBlock from './renderBlock'

// --- Contrast enforcement for mermaid SVGs ---

// Parse a CSS colour string to [r, g, b] (0-255). Handles #hex, rgb(), rgba(), named.
const parseColor = (str) => {
  if (!str || str === 'none' || str === 'transparent') return null
  str = str.trim()
  // #hex
  if (str.startsWith('#')) {
    let hex = str.slice(1)
    if (hex.length === 3) hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2]
    if (hex.length === 8) hex = hex.slice(0, 6) // strip alpha
    const n = parseInt(hex, 16)
    if (isNaN(n)) return null
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
  }
  // rgb()/rgba()
  const m = str.match(/rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/)
  if (m) return [Math.round(+m[1]), Math.round(+m[2]), Math.round(+m[3])]
  return null
}

// Relative luminance per WCAG 2.1 (0 = black, 1 = white)
const luminance = ([r, g, b]) => {
  const f = (v) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4) }
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
}

// WCAG contrast ratio (1:1 to 21:1)
const contrastRatio = (c1, c2) => {
  const l1 = luminance(c1)
  const l2 = luminance(c2)
  const lighter = Math.max(l1, l2)
  const darker = Math.min(l1, l2)
  return (lighter + 0.05) / (darker + 0.05)
}

// Extract the fill colour from an SVG shape, checking both attribute and computed style
const getShapeFill = (shape) => {
  // Computed style is most reliable — catches inline style, CSS, and attribute
  const computed = window.getComputedStyle(shape).fill
  const parsed = parseColor(computed)
  if (parsed) return parsed
  // Fallback to attribute
  return parseColor(shape.getAttribute('fill'))
}

// Find the effective background colour of an SVG text element by walking up
// the DOM looking for filled shapes, foreignObject backgrounds, or node rects.
const findBackground = (el) => {
  let node = el.parentElement
  while (node && node.tagName !== 'svg') {
    // foreignObject: check child element background-color
    if (node.tagName === 'foreignObject') {
      const div = node.querySelector('div, span, p')
      if (div) {
        const bg = parseColor(window.getComputedStyle(div).backgroundColor)
        if (bg) return bg
      }
    }

    // Any g element: look for direct child shapes (rect, polygon, etc.)
    if (node.tagName === 'g') {
      const shapes = node.querySelectorAll(':scope > rect, :scope > polygon, :scope > circle, :scope > ellipse')
      for (const shape of shapes) {
        const fill = getShapeFill(shape)
        if (fill) return fill
      }
    }

    node = node.parentElement
  }
  return null
}

// Minimum WCAG AA contrast ratio for normal text
const MIN_CONTRAST = 4.5

// Get the page canvas background colour as fallback
const getPageBackground = () => {
  const style = window.getComputedStyle(document.documentElement)
  const bg = style.getPropertyValue('--editorBgColor').trim()
  return parseColor(bg) || [255, 255, 255]
}

// Fix all text elements in an SVG that have poor contrast against their background
const fixSvgContrast = (svg) => {
  if (!svg) return
  const BLACK = [0, 0, 0]
  const WHITE = [255, 255, 255]
  const pageBg = getPageBackground()

  const pickFix = (bg) => {
    const blackRatio = contrastRatio(BLACK, bg)
    const whiteRatio = contrastRatio(WHITE, bg)
    return blackRatio > whiteRatio ? '#000000' : '#ffffff'
  }

  // Fix SVG <text> elements
  const texts = svg.querySelectorAll('text')
  for (const text of texts) {
    const fillAttr = text.getAttribute('fill') || window.getComputedStyle(text).fill
    const textColor = parseColor(fillAttr)
    if (!textColor) continue

    // Use the nearest background shape, or fall back to the page canvas
    const bg = findBackground(text) || pageBg

    const ratio = contrastRatio(textColor, bg)
    if (ratio < MIN_CONTRAST) {
      const fix = pickFix(bg)
      text.setAttribute('fill', fix)
      text.style.fill = fix
    }
  }

  // Fix foreignObject HTML text (edge labels, node labels in some diagrams)
  const foTexts = svg.querySelectorAll('foreignObject span, foreignObject p, foreignObject div')
  for (const el of foTexts) {
    const style = window.getComputedStyle(el)
    const textColor = parseColor(style.color)
    const bgColor = parseColor(style.backgroundColor)
    if (!textColor) continue

    const bg = bgColor || findBackground(el) || pageBg

    const ratio = contrastRatio(textColor, bg)
    if (ratio < MIN_CONTRAST) {
      el.style.color = pickFix(bg)
    }
  }
}

class StateRender {
  constructor (muya) {
    this.muya = muya
    this.eventCenter = muya.eventCenter
    this.codeCache = new Map()
    this.loadImageMap = new Map()
    this.loadMathMap = new Map()
    this.mermaidCache = new Map()
    this.diagramCache = new Map()
    this.tokenCache = new Map()
    this.labels = new Map()
    this.urlMap = new Map()
    this.renderingTable = null
    this.renderingRowContainer = null
    this.container = null
  }

  setContainer (container) {
    this.container = container
  }

  // collect link reference definition
  collectLabels (blocks) {
    this.labels.clear()

    const travel = block => {
      const { text, children } = block
      if (children && children.length) {
        children.forEach(c => travel(c))
      } else if (text) {
        const tokens = beginRules.reference_definition.exec(text)
        if (tokens) {
          const key = (tokens[2] + tokens[3]).toLowerCase()
          if (!this.labels.has(key)) {
            this.labels.set(key, {
              href: tokens[6],
              title: tokens[10] || ''
            })
          }
        }
      }
    }

    blocks.forEach(b => travel(b))
  }

  checkConflicted (block, token, cursor) {
    const { start, end } = cursor
    const key = block.key
    const { start: tokenStart, end: tokenEnd } = token.range

    if (key !== start.key && key !== end.key) {
      return false
    } else if (key === start.key && key !== end.key) {
      return conflict([tokenStart, tokenEnd], [start.offset, start.offset])
    } else if (key !== start.key && key === end.key) {
      return conflict([tokenStart, tokenEnd], [end.offset, end.offset])
    } else {
      return conflict([tokenStart, tokenEnd], [start.offset, start.offset]) ||
        conflict([tokenStart, tokenEnd], [end.offset, end.offset])
    }
  }

  getClassName (outerClass, block, token, cursor) {
    return outerClass || (this.checkConflicted(block, token, cursor) ? CLASS_OR_ID.AG_GRAY : CLASS_OR_ID.AG_HIDE)
  }

  getHighlightClassName (active) {
    return active ? CLASS_OR_ID.AG_HIGHLIGHT : CLASS_OR_ID.AG_SELECTION
  }

  getSelector (block, activeBlocks) {
    const { cursor, selectedBlock } = this.muya.contentState
    const type = block.type === 'hr' ? 'p' : block.type
    const isActive = activeBlocks.some(b => b.key === block.key) || block.key === cursor.start.key

    let selector = `${type}#${block.key}.${CLASS_OR_ID.AG_PARAGRAPH}`
    if (isActive) {
      selector += `.${CLASS_OR_ID.AG_ACTIVE}`
    }
    if (type === 'span') {
      selector += `.ag-${camelToSnake(block.functionType)}`
    }
    if (!block.parent && selectedBlock && block.key === selectedBlock.key) {
      selector += `.${CLASS_OR_ID.AG_SELECTED}`
    }
    return selector
  }

  async renderMermaid () {
    if (this.mermaidCache.size) {
      const mermaid = await loadRenderer('mermaid')

      // Only override the specific themeVariables that mermaid gets wrong.
      // Do NOT override node text colours — mermaid's own themes handle
      // contrast correctly (white text on dark fills, dark on light fills).
      // We only fix: edge label backgrounds, pie legends, and signal text.
      const isDark = document.body.classList.contains('dark')
      const labelColor = isDark ? '#ffffff' : '#1a1a1a'
      const neutralBg = isDark ? '#1e1e1e' : '#ffffff'

      mermaid.initialize({
        securityLevel: 'strict',
        theme: this.muya.options.mermaidTheme || 'default',
        themeVariables: {
          edgeLabelBackground: neutralBg,
          signalTextColor: labelColor,
          pieTitleTextColor: labelColor,
          pieSectionTextColor: '#fff',
          pieLegendTextColor: labelColor
        },
        startOnLoad: false,
        logLevel: 'error'
      })

      // Wait longer for DOM to be fully ready
      await new Promise(resolve => setTimeout(resolve, 200))

      // Prepare all diagrams first
      const targets = []
      for (const [key, value] of this.mermaidCache.entries()) {
        const { code } = value
        const target = document.querySelector(key)
        if (!target) {
          continue
        }

        try {
          // Clean up any previous mermaid content
          target.removeAttribute('data-processed')
          target.innerHTML = '' // Clear previous content

          // Force layout recalculation and visibility
          // eslint-disable-next-line no-unused-expressions
          target.offsetHeight
          target.style.visibility = 'visible'
          target.style.display = 'block'

          // v11: parse first to validate
          await mermaid.parse(code)

          // v11: set the code content
          target.textContent = code
          targets.push(target)
        } catch (err) {
          console.error('Mermaid parse error for:', code.substring(0, 50), err)
          target.innerHTML = '< Invalid Mermaid Codes >'
          target.classList.add(CLASS_OR_ID.AG_MATH_ERROR)
        }
      }

      // Render all diagrams at once if we have any
      if (targets.length > 0) {
        try {
          await mermaid.run({
            nodes: targets,
            suppressErrors: false
          })

          // Force multiple repaints to ensure visibility
          await new Promise(resolve => {
            requestAnimationFrame(() => {
              requestAnimationFrame(() => {
                requestAnimationFrame(resolve)
              })
            })
          })

          // Fix any text with insufficient contrast against its background
          for (const target of targets) {
            const figure = target.closest('figure')
            const preview = figure ? figure.querySelector('.ag-container-preview') : null
            const svg = preview ? preview.querySelector('svg') : null
            if (svg) fixSvgContrast(svg)
          }
        } catch (err) {
          console.error('Mermaid batch render error:', err)
          // Fallback: try individual rendering
          for (const target of targets) {
            try {
              await mermaid.run({
                nodes: [target],
                suppressErrors: false
              })
            } catch (individualErr) {
              console.error('Individual render fallback failed:', individualErr)
            }
          }
        }
      }

      this.mermaidCache.clear()
    }
  }

  async renderDiagram () {
    const cache = this.diagramCache
    if (cache.size) {
      const RENDER_MAP = {
        flowchart: await loadRenderer('flowchart'),
        sequence: await loadRenderer('sequence'),
        plantuml: await loadRenderer('plantuml'),
        'vega-lite': await loadRenderer('vega-lite')
      }

      for (const [key, value] of cache.entries()) {
        const target = document.querySelector(key)
        if (!target) {
          continue
        }
        const { code, functionType } = value
        const render = RENDER_MAP[functionType]
        const options = {}
        if (functionType === 'sequence') {
          Object.assign(options, { theme: this.muya.options.sequenceTheme })
        } else if (functionType === 'vega-lite') {
          Object.assign(options, {
            actions: false,
            tooltip: false,
            renderer: 'svg',
            theme: this.muya.options.vegaTheme
          })
        }
        try {
          if (functionType === 'flowchart' || functionType === 'sequence') {
            const diagram = render.parse(code)
            target.innerHTML = ''
            diagram.drawSVG(target, options)
          } else if (functionType === 'plantuml') {
            const diagram = render.parse(code)
            target.innerHTML = ''
            diagram.insertImgElement(target)
          } else if (functionType === 'vega-lite') {
            await render(key, JSON.parse(code), options)
          }
        } catch (err) {
          target.innerHTML = `< Invalid ${functionType === 'flowchart' ? 'Flow Chart' : 'Sequence'} Codes >`
          target.classList.add(CLASS_OR_ID.AG_MATH_ERROR)
        }
      }
      this.diagramCache.clear()
    }
  }

  render (blocks, activeBlocks, matches) {
    const selector = `div#${CLASS_OR_ID.AG_EDITOR_ID}`
    const children = blocks.map(block => {
      return this.renderBlock(null, block, activeBlocks, matches, true)
    })
    const newVdom = h(selector, children)
    const rootDom = document.querySelector(selector) || this.container
    const oldVdom = toVNode(rootDom)

    patch(oldVdom, newVdom)
    this.renderMermaid()
    this.renderDiagram()
    this.codeCache.clear()
  }

  // Only render the blocks which you updated
  partialRender (blocks, activeBlocks, matches, startKey, endKey) {
    const cursorOutMostBlock = activeBlocks[activeBlocks.length - 1]
    // If cursor is not in render blocks, need to render cursor block independently
    const needRenderCursorBlock = blocks.indexOf(cursorOutMostBlock) === -1
    const newVnode = h('section', blocks.map(block => this.renderBlock(null, block, activeBlocks, matches)))
    const html = toHTML(newVnode).replace(/^<section>([\s\S]+?)<\/section>$/, '$1')

    const needToRemoved = []
    const firstOldDom = startKey
      ? document.querySelector(`#${startKey}`)
      : document.querySelector(`div#${CLASS_OR_ID.AG_EDITOR_ID}`).firstElementChild
    if (!firstOldDom) {
      // TODO@Jocs Just for fix #541, Because I'll rewrite block and render method, it will nolonger have this issue.
      return
    }
    needToRemoved.push(firstOldDom)
    let nextSibling = firstOldDom.nextElementSibling
    while (nextSibling && nextSibling.id !== endKey) {
      needToRemoved.push(nextSibling)
      nextSibling = nextSibling.nextElementSibling
    }
    nextSibling && needToRemoved.push(nextSibling)

    firstOldDom.insertAdjacentHTML('beforebegin', html)

    Array.from(needToRemoved).forEach(dom => dom.remove())

    // Render cursor block independently
    if (needRenderCursorBlock) {
      const { key } = cursorOutMostBlock
      const cursorDom = document.querySelector(`#${key}`)
      if (cursorDom) {
        const oldCursorVnode = toVNode(cursorDom)
        const newCursorVnode = this.renderBlock(null, cursorOutMostBlock, activeBlocks, matches)
        patch(oldCursorVnode, newCursorVnode)
      }
    }

    this.renderMermaid()
    this.renderDiagram()
    this.codeCache.clear()
  }

  /**
   * Only render one block.
   *
   * @param {object} block
   * @param {array} activeBlocks
   * @param {array} matches
   */
  singleRender (block, activeBlocks, matches) {
    const selector = `#${block.key}`
    const newVdom = this.renderBlock(null, block, activeBlocks, matches, true)
    const rootDom = document.querySelector(selector)
    const oldVdom = toVNode(rootDom)
    patch(oldVdom, newVdom)
    this.renderMermaid()
    this.renderDiagram()
    this.codeCache.clear()
  }

  invalidateImageCache () {
    this.loadImageMap.forEach((imageInfo, key) => {
      imageInfo.touchMsec = Date.now()
      this.loadImageMap.set(key, imageInfo)
    })
  }
}

mixins(StateRender, renderInlines, renderBlock)

export default StateRender
