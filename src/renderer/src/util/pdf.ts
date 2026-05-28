import Slugger from 'muya/lib/parser/marked/slugger'
import { escapeHTML, unescapeHTML } from 'muya/lib/utils'
import academicTheme from '@/assets/themes/export/academic.theme.css?inline'
import liberTheme from '@/assets/themes/export/liber.theme.css?inline'
import { deepClone } from '../util'
import { sanitize, EXPORT_DOMPURIFY_CONFIG } from '../util/dompurify'

export interface PdfCssOptions {
  type?: string
  pageMarginTop?: number
  pageMarginRight?: number
  pageMarginBottom?: number
  pageMarginLeft?: number
  fontFamily?: string
  fontSize?: number
  lineHeight?: number | string
  autoNumberingHeadings?: boolean
  showFrontMatter?: boolean
  theme?: string
  headerFooterFontSize?: number
  [key: string]: unknown
}

export const getCssForOptions = async(options: PdfCssOptions): Promise<string> => {
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { userDataPath } = (window as any).marktext.paths as { userDataPath: string }
      const themePath = window.path.join(userDataPath, 'themes/export', theme)
      if (await window.fileUtils.isFile(themePath)) {
        try {
          const buf = await window.fileUtils.readFile(themePath)
          const themeCSS =
            buf instanceof Uint8Array ? new TextDecoder('utf-8').decode(buf) : String(buf)
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
  return unescapeHTML(sanitize(escapeHTML(output), EXPORT_DOMPURIFY_CONFIG))
}

export interface TocEntry {
  lvl: number
  content: string
  slug?: string
  [key: string]: unknown
}

export interface HtmlTocOptions {
  tocIncludeTopHeading?: boolean
  tocTitle?: string
  [key: string]: unknown
}

const generateHtmlToc = (
  tocList: TocEntry[],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  slugger: any,
  currentLevel: number,
  options: HtmlTocOptions
): string => {
  if (!tocList || tocList.length === 0) {
    return ''
  }

  const topLevel = tocList[0].lvl
  if (!options.tocIncludeTopHeading && topLevel <= 1) {
    tocList.shift()
    return generateHtmlToc(tocList, slugger, currentLevel, options)
  } else if (topLevel <= currentLevel) {
    return ''
  }

  const shifted = tocList.shift() as TocEntry
  const { content, lvl } = shifted
  const slug = slugger.slug(content)

  let html = `<li><span><a class="toc-h${lvl}" href="#${slug}">${content}</a><span class="dots"></span></span>`

  // Generate sub-items
  if (tocList.length !== 0 && tocList[0].lvl > lvl) {
    html += '<ul>' + generateHtmlToc(tocList, slugger, lvl, options) + '</ul>'
  }

  html += '</li>' + generateHtmlToc(tocList, slugger, currentLevel, options)
  return html
}

export const getHtmlToc = (toc: TocEntry[], options: HtmlTocOptions = {}): string => {
  const list = deepClone(toc)
  const slugger = new Slugger()
  const tocList = generateHtmlToc(list, slugger, 0, options)
  if (!tocList) {
    return ''
  }

  const title = options.tocTitle ? options.tocTitle : 'Table of Contents'
  const html = `<div class="toc-container"><p class="toc-title">${title}</p><ul class="toc-list">${tocList}</ul></div>`
  return sanitize(html, EXPORT_DOMPURIFY_CONFIG)
}

// Don't use "Noto Color Emoji" because it will result in PDF files with multiple MB and weird looking emojis.
const FALLBACK_FONT_FAMILIES =
  '"Open Sans","Segoe UI","Helvetica Neue",Helvetica,Arial,sans-serif,"Apple Color Emoji","Segoe UI Emoji"'

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
