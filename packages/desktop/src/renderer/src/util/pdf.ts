// `escapeHTML`/`unescapeHTML` are migrated to @muyajs/core (identical impl).
// The TOC anchors produced here (`#${slug}`) must match the heading `id`
// attributes in the exported document. Now that editor.vue exports via
// @muyajs/core (#4406) and the engine injects github-compatible heading ids
// (#4412), this module derives its slugs from the SAME `generateGithubSlug`
// algorithm, with the SAME `-N` document-order dedup the engine uses, so the
// in-document TOC links resolve.
import { escapeHTML, unescapeHTML, generateGithubSlug } from '@muyajs/core'
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
      const { userDataPath } = window.marktext!.paths as { userDataPath: string }
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

  // Font options. Emitted AFTER the theme CSS so the "Overwrite theme font"
  // settings win the cascade: a selected export theme also sets `.markdown-body`
  // font-size/line-height/font-family, and at equal specificity the later rule
  // wins — so the user's override must come last to actually override the theme.
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

// Replicate @muyajs/core's `MarkdownToHtml#_injectHeadingIds` slugging so the
// TOC `href="#slug"` anchors target the exact ids the engine writes onto the
// exported `<h1>..<h6>`: github-compatible base slug (falling back to
// `heading` when the text slugs to empty), deduplicated in document order with
// an incrementing `-N` suffix. Computed over the FULL heading list in order
// (before the render-time filtering below) to keep the dedup sequence aligned
// with the engine's whole-document pass.
const assignHeadingSlugs = (tocList: TocEntry[]): void => {
  const seen = new Set<string>()
  for (const entry of tocList) {
    const base = generateGithubSlug(entry.content) || 'heading'
    let slug = base
    let n = 1
    while (seen.has(slug)) {
      slug = `${base}-${n++}`
    }
    seen.add(slug)
    entry.slug = slug
  }
}

const generateHtmlToc = (
  tocList: TocEntry[],
  currentLevel: number,
  options: HtmlTocOptions
): string => {
  if (!tocList || tocList.length === 0) {
    return ''
  }

  const topLevel = tocList[0].lvl
  if (!options.tocIncludeTopHeading && topLevel <= 1) {
    tocList.shift()
    return generateHtmlToc(tocList, currentLevel, options)
  } else if (topLevel <= currentLevel) {
    return ''
  }

  const shifted = tocList.shift() as TocEntry
  const { content, lvl, slug } = shifted

  let html = `<li><span><a class="toc-h${lvl}" href="#${slug}">${content}</a><span class="dots"></span></span>`

  // Generate sub-items
  if (tocList.length !== 0 && tocList[0].lvl > lvl) {
    html += '<ul>' + generateHtmlToc(tocList, lvl, options) + '</ul>'
  }

  html += '</li>' + generateHtmlToc(tocList, currentLevel, options)
  return html
}

export const getHtmlToc = (toc: TocEntry[], options: HtmlTocOptions = {}): string => {
  const list = deepClone(toc)
  assignHeadingSlugs(list)
  const tocList = generateHtmlToc(list, 0, options)
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
