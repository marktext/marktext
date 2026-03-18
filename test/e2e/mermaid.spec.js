const { expect, test } = require('@playwright/test')
const path = require('path')
const fs = require('fs')
const { launchElectron } = require('./helpers')

const MERMAID_TEST_FILE = path.resolve(__dirname, '../../temp/test-mermaid-all-diagrams.md')

function extractDiagramInfo (filePath) {
  const md = fs.readFileSync(filePath, 'utf-8')
  const lines = md.split('\n')
  const diagrams = []
  let currentHeading = ''
  let inBlock = false
  let code = ''

  for (const line of lines) {
    if (line.startsWith('#')) {
      currentHeading = line.replace(/^#+\s*/, '').trim()
    }
    if (line.trim().startsWith('```mermaid')) {
      inBlock = true
      code = ''
      continue
    }
    if (inBlock && line.trim() === '```') {
      inBlock = false
      // Find the actual diagram type keyword, skipping %%{init:} and --- frontmatter
      const codeLines = code.trim().split('\n').map(l => l.trim())
      let diagramType = 'unknown'
      let inFrontmatter = false
      for (const cl of codeLines) {
        if (cl.startsWith('---')) { inFrontmatter = !inFrontmatter; continue }
        if (inFrontmatter) continue
        if (cl.startsWith('%%{')) continue
        if (cl === '') continue
        diagramType = cl.split(/[\s\n]/)[0]
        break
      }
      diagrams.push({ heading: currentHeading, type: diagramType, code: code.trim() })
      continue
    }
    if (inBlock) {
      code += line + '\n'
    }
  }
  return diagrams
}

test.describe('Mermaid Diagram Rendering', () => {
  test.setTimeout(120000)

  let app = null
  let page = null

  test.beforeAll(async () => {
    expect(fs.existsSync(MERMAID_TEST_FILE)).toBeTruthy()

    const { app: electronApp, page: firstPage } = await launchElectron([
      MERMAID_TEST_FILE
    ])
    app = electronApp
    page = firstPage

    // Wait for file load + mermaid async rendering (200ms delay + rAF + batch)
    await page.waitForTimeout(10000)
  })

  test.afterAll(async () => {
    if (app) {
      await app.close()
    }
  })

  test('file loaded successfully', async () => {
    const title = await page.title()
    expect(title).toContain('MarkText')
  })

  test('mermaid containers are present in DOM', async () => {
    const count = await page.evaluate(() =>
      document.querySelectorAll('pre.ag-mermaid').length
    )
    const expected = extractDiagramInfo(MERMAID_TEST_FILE).length
    console.log(`  Found ${count} mermaid containers, expected ${expected}`)
    expect(count).toBeGreaterThanOrEqual(expected)
  })

  test('mermaid diagrams render as SVG', async () => {
    // Mermaid SVGs are rendered in .ag-container-preview siblings
    // of the .ag-mermaid <pre> elements, inside the parent <figure>
    const results = await page.evaluate(() => {
      const containers = document.querySelectorAll('pre.ag-mermaid')
      return Array.from(containers).map((pre, i) => {
        const figure = pre.closest('figure.ag-container-block') || pre.parentElement
        const preview = figure ? figure.querySelector('.ag-container-preview') : null
        const svg = preview ? preview.querySelector('svg') : null
        const hasError = pre.classList.contains('ag-math-error') ||
                         pre.textContent.includes('Invalid Mermaid')
        const isLoading = pre.textContent.includes('Loading')

        return {
          index: i,
          rendered: svg !== null && !hasError,
          hasSvg: svg !== null,
          hasError,
          isLoading,
          svgId: svg ? svg.id : null,
          svgRole: svg ? svg.getAttribute('aria-roledescription') : null,
          contentPreview: pre.textContent.substring(0, 50).replace(/\n/g, ' ')
        }
      })
    })

    const total = results.length
    const rendered = results.filter(r => r.rendered).length
    const errored = results.filter(r => r.hasError).length
    const loading = results.filter(r => r.isLoading).length
    const noSvg = results.filter(r => !r.hasSvg && !r.hasError && !r.isLoading).length

    console.log(`\n  Rendering Summary:`)
    console.log(`    Total:     ${total}`)
    console.log(`    Rendered:  ${rendered} (SVG present)`)
    console.log(`    Errored:   ${errored} (parse/render errors)`)
    console.log(`    Loading:   ${loading} (still loading)`)
    console.log(`    No SVG:    ${noSvg} (missing SVG, no error)`)

    // Show diagram types that rendered
    const renderedTypes = {}
    results.filter(r => r.rendered).forEach(r => {
      const type = r.svgRole || 'unknown'
      renderedTypes[type] = (renderedTypes[type] || 0) + 1
    })
    if (Object.keys(renderedTypes).length > 0) {
      console.log(`\n  Rendered diagram types:`)
      for (const [type, count] of Object.entries(renderedTypes).sort()) {
        console.log(`    ${type}: ${count}`)
      }
    }

    if (errored > 0) {
      console.log(`\n  Errored diagrams:`)
      results.filter(r => r.hasError).forEach(r => {
        console.log(`    [${r.index}] ${r.contentPreview}`)
      })
    }

    if (noSvg > 0) {
      console.log(`\n  Unrendered diagrams (${noSvg}):`)
      results.filter(r => !r.hasSvg && !r.hasError && !r.isLoading).forEach(r => {
        console.log(`    [${r.index}] ${r.contentPreview}`)
      })
    }

    const passRate = total > 0 ? rendered / total : 0
    console.log(`\n  Pass rate: ${(passRate * 100).toFixed(1)}%`)

    // At least 85% should render successfully
    expect(passRate).toBeGreaterThanOrEqual(0.85)
  })

  test('all major diagram types render at least one example', async () => {
    const diagrams = extractDiagramInfo(MERMAID_TEST_FILE)
    const results = await page.evaluate(() => {
      const containers = document.querySelectorAll('pre.ag-mermaid')
      return Array.from(containers).map(pre => {
        const figure = pre.closest('figure.ag-container-block') || pre.parentElement
        const preview = figure ? figure.querySelector('.ag-container-preview') : null
        const svg = preview ? preview.querySelector('svg') : null
        return {
          hasSvg: svg !== null,
          hasError: pre.classList.contains('ag-math-error') || pre.textContent.includes('Invalid Mermaid'),
          svgRole: svg ? svg.getAttribute('aria-roledescription') : null
        }
      })
    })

    // Map results back to diagram types
    const typeResults = {}
    diagrams.forEach((d, i) => {
      const type = d.type
      if (!typeResults[type]) typeResults[type] = { total: 0, rendered: 0 }
      typeResults[type].total++
      if (results[i] && results[i].hasSvg && !results[i].hasError) {
        typeResults[type].rendered++
      }
    })

    console.log('\n  Per-type rendering results:')
    const allTypes = Object.keys(typeResults).sort()
    for (const type of allTypes) {
      const r = typeResults[type]
      const pct = r.total > 0 ? ((r.rendered / r.total) * 100).toFixed(0) : 0
      const status = r.rendered > 0 ? 'PASS' : 'FAIL'
      console.log(`    ${status}  ${type}: ${r.rendered}/${r.total} (${pct}%)`)
    }

    const majorTypes = [
      'sequenceDiagram', 'classDiagram', 'stateDiagram-v2', 'erDiagram',
      'gantt', 'pie', 'gitGraph', 'mindmap', 'timeline', 'journey',
      'quadrantChart', 'block', 'requirementDiagram'
    ]

    const failedTypes = majorTypes.filter(type =>
      typeResults[type] && typeResults[type].rendered === 0
    )

    if (failedTypes.length > 0) {
      console.log(`\n  FAILED major types: ${failedTypes.join(', ')}`)
    }

    // All major diagram types should render at least one example
    expect(failedTypes.length).toBe(0)
  })
})
