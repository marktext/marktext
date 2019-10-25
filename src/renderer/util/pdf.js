import fs from 'fs-extra'
import path from 'path'
import createDOMPurify from 'dompurify'
import { isFile } from 'common/filesystem'
import academicTheme from '@/assets/themes/export/academic.theme.css'
import liberTheme from '@/assets/themes/export/liber.theme.css'

const { sanitize } = createDOMPurify(window)

export const getCssForOptions = options => {
  const {
    type,
    pageMarginTop,
    pageMarginRight,
    pageMarginBottom,
    pageMarginLeft,
    fontFamily,
    fontSize,
    lineHeight,
    autoNumberingHeadings,
    showFrontMatter,
    theme,
    headerFooterFontSize
  } = options
  const isPrintable = type !== 'styledHtml'

  let output = ''
  if (isPrintable) {
    output += `@media print{@page{
      margin: ${pageMarginTop}mm ${pageMarginRight}mm ${pageMarginBottom}mm ${pageMarginLeft}mm;}`
  }

  // Font options
  output += '.markdown-body{'
  if (fontFamily) {
    output += `font-family:"${fontFamily}",${FALLBACK_FONT_FAMILIES};`
    output = `.hf-container{font-family:"${fontFamily}",${FALLBACK_FONT_FAMILIES};}${output}`
  }
  if (fontSize) {
    output += `font-size:${fontSize}px;`
  }
  if (lineHeight) {
    output += `line-height:${lineHeight};`
  }
  output += '}'

  // Auto numbering headings via CSS
  if (autoNumberingHeadings) {
    output += autoNumberingHeadingsCss
  }

  // Hide front matter
  if (!showFrontMatter) {
    output += 'pre.front-matter{display:none!important;}'
  }

  if (theme) {
    if (theme === 'academic') {
      output += academicTheme
    } else if (theme === 'liber') {
      output += liberTheme
    } else {
      // Read theme from disk
      const { userDataPath } = global.marktext.paths
      const themePath = path.join(userDataPath, 'themes/export', theme)
      if (isFile(themePath)) {
        try {
          const themeCSS = fs.readFileSync(themePath, 'utf8')
          output += themeCSS
        } catch (_) {
          // No-op
        }
      }
    }
  }

  if (headerFooterFontSize) {
    output += `.page-header .hf-container,
    .page-footer-fake .hf-container,
    .page-footer .hf-container {
      font-size: ${headerFooterFontSize}px;
    }`
  }

  if (isPrintable) {
    // Close @page
    output += '}'
  }
  return sanitize(output, EXPORT_DOMPURIFY_CONFIG)
}

const EXPORT_DOMPURIFY_CONFIG = {
  FORBID_ATTR: ['contenteditable'],
  ALLOW_DATA_ATTR: false,
  USE_PROFILES: {
    html: true,
    svg: true,
    svgFilters: true,
    mathMl: true
  }
}

// Don't use "Noto Color Emoji" because it will result in PDF files with multiple MB and weird looking emojis.
const FALLBACK_FONT_FAMILIES = '"Open Sans","Segoe UI","Helvetica Neue",Helvetica,Arial,sans-serif,"Apple Color Emoji","Segoe UI Emoji"'

const autoNumberingHeadingsCss = `body {counter-reset: h2}
h2 {counter-reset: h3}
h3 {counter-reset: h4}
h4 {counter-reset: h5}
h5 {counter-reset: h6}
h2:before {counter-increment: h2; content: counter(h2) ". "}
h3:before {counter-increment: h3; content: counter(h2) "." counter(h3) ". "}
h4:before {counter-increment: h4; content: counter(h2) "." counter(h3) "." counter(h4) ". "}
h5:before {counter-increment: h5; content: counter(h2) "." counter(h3) "." counter(h4) "." counter(h5) ". "}
h6:before {counter-increment: h6; content: counter(h2) "." counter(h3) "." counter(h4) "." counter(h5) "." counter(h6) ". "}
h2.nocount:before, h3.nocount:before, h4.nocount:before, h5.nocount:before, h6.nocount:before { content: ""; counter-increment: none }`
