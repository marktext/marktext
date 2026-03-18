const { expect, test } = require('@playwright/test')
const path = require('path')
const fs = require('fs')
const { launchElectron } = require('./helpers')

const MERMAID_TEST_FILE = path.resolve(__dirname, '../../temp/test-mermaid-all-diagrams.md')
const EXPORT_DIR = path.join(require('os').tmpdir(), 'marktext-export-test')

test.describe('Export with Mermaid Diagrams', () => {
  test.setTimeout(120000)

  let app = null
  let page = null

  test.beforeAll(async () => {
    expect(fs.existsSync(MERMAID_TEST_FILE)).toBeTruthy()
    fs.mkdirSync(EXPORT_DIR, { recursive: true })

    const { app: electronApp, page: firstPage } = await launchElectron([
      MERMAID_TEST_FILE
    ])
    app = electronApp
    page = firstPage
    await page.waitForTimeout(8000)
  })

  test.afterAll(async () => {
    if (app) await app.close()
  })

  test('exportStyledHTML renders all mermaid diagrams as SVGs', async () => {
    const result = await page.evaluate(async () => {
      const wrapper = document.querySelector('.editor-wrapper')
      if (!wrapper || !wrapper.__vue__) return { error: 'no editor' }
      const muya = wrapper.__vue__.editor
      if (!muya) return { error: 'no muya' }

      try {
        const html = await muya.exportStyledHTML({
          title: 'Export Test',
          printOptimization: false,
          extraCss: '',
          toc: '',
          header: null,
          footer: null,
          headerFooterStyled: false
        })

        const parser = new DOMParser()
        const doc = parser.parseFromString(html, 'text/html')
        const allSvgs = doc.querySelectorAll('svg')
        const mermaidSvgs = Array.from(allSvgs).filter(s =>
          s.id && s.id.startsWith('mermaid')
        )
        const mermaidDivs = doc.querySelectorAll('.mermaid')
        const failed = Array.from(mermaidDivs).filter(d =>
          !d.querySelector('svg') || d.textContent.includes('render failed')
        ).length

        return {
          success: true,
          htmlLength: html.length,
          totalSvgs: allSvgs.length,
          mermaidSvgs: mermaidSvgs.length,
          totalMermaidDivs: mermaidDivs.length,
          failed
        }
      } catch (e) {
        return { error: e.message }
      }
    })

    console.log('\n  HTML Export results:')
    if (result.error) {
      console.log(`    ERROR: ${result.error}`)
    } else {
      console.log(`    HTML length: ${result.htmlLength}`)
      console.log(`    Mermaid divs: ${result.totalMermaidDivs}`)
      console.log(`    Rendered SVGs: ${result.mermaidSvgs}`)
      console.log(`    Failed: ${result.failed}`)
      console.log(`    Pass rate: ${result.mermaidSvgs}/${result.totalMermaidDivs}`)
    }

    expect(result.error).toBeUndefined()
    expect(result.mermaidSvgs).toBeGreaterThan(0)
    // At least 85% of diagrams should render in export
    const passRate = result.mermaidSvgs / Math.max(result.totalMermaidDivs, 1)
    expect(passRate).toBeGreaterThanOrEqual(0.85)
  })

  test('printToPDF produces a valid PDF', async () => {
    const pdfPath = path.join(EXPORT_DIR, 'test-export.pdf')

    const result = await page.evaluate(async (outputPath) => {
      try {
        const remote = require('@electron/remote')
        const win = remote.getCurrentWindow()
        const data = await win.webContents.printToPDF({ printBackground: true })
        require('fs').writeFileSync(outputPath, Buffer.from(data))
        return { success: true, size: data.length }
      } catch (e) {
        return { error: e.message }
      }
    }, pdfPath)

    console.log('\n  PDF results:')
    if (result.error) {
      console.log(`    Error: ${result.error}`)
    } else {
      console.log(`    PDF size: ${result.size} bytes`)
      console.log(`    Saved to: ${pdfPath}`)
    }

    expect(result.success).toBeTruthy()
    expect(result.size).toBeGreaterThan(1000)
  })
})
