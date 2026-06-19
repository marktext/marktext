// Desktop-side styled-HTML export wrapper for the @muyajs/core engine.
//
// The new engine (`@muyajs/core`) exposes `MarkdownToHtml(md, muya).generate()`
// which produces a full standalone HTML document (markdown rendered, diagrams
// rasterised, github-markdown-css + katex + prism linked, plus the engine
// export stylesheet). It has NO equivalent of the legacy muyajs
// `exportStyledHTML`, which additionally injected a table-of-contents at the
// `[TOC]` marker and wrapped the article in a header/footer page table for PDF
// / print. This helper reproduces that desktop-specific behaviour on top of the
// engine output so the export result stays equivalent to the legacy engine.

import type { Muya } from '@muyajs/core'
import { MarkdownToHtml } from '@muyajs/core'
import { sanitize, EXPORT_DOMPURIFY_CONFIG } from './dompurify'
import { resolveLocalImageSrc } from './resolveImageSrc'

export interface HeaderFooterPart {
  type?: number
  left?: string
  center?: string
  right?: string
}

export interface ExportStyledHtmlOptions {
  title?: string
  printOptimization?: boolean
  extraCss?: string
  /** Pre-rendered TOC HTML (from `getHtmlToc`). Injected at `[TOC]`. */
  toc?: string
  header?: HeaderFooterPart | null
  footer?: HeaderFooterPart | null
  headerFooterStyled?: boolean
}

// Ported verbatim from legacy muyajs `headerFooterStyle.css` so the page
// header/footer table lays out the same in the exported document.
const HEADER_FOOTER_CSS = `
:root { --footerHeaderBorderColor: #1c1c1c; }
table.page-container { width: 100%; border-collapse: collapse; }
table.page-container > tbody,
table.page-container > tbody > tr,
table.page-container > tbody > tr > td { display: block; width: 100vw; }
table.page-container > tbody > tr > td { overflow-wrap: anywhere; }
table.page-container > thead,
table.page-container > tfoot { display: table-header-group; }
.page-header .hf-container,
.page-footer-fake .hf-container,
.page-footer .hf-container { display: flex; justify-content: space-between; font-size: 0.75em; font-weight: 400; }
.page-header { display: table-header-group; }
.page-header .hf-container { margin-bottom: 16px; }
.page-header.styled .hf-container { padding-bottom: 1px; border-bottom: 1px solid var(--footerHeaderBorderColor); }
.page-header .hf-container > div { flex: 1; max-height: 100px; overflow: hidden; }
.page-header .header-content-left { text-align: left; margin-right: 4px; }
.page-header .header-content { text-align: center; }
.page-header .header-content-right { text-align: right; margin-left: 4px; }
.page-header.single .header-content-left,
.page-header.single .header-content-right { display: none; }
.page-footer-fake { display: table-footer-group; }
.page-footer-fake .hf-container { margin-top: 16px; visibility: hidden; }
.page-footer { position: fixed; bottom: 0; left: 0; right: 0; }
.page-footer.styled .hf-container { padding-top: 1px; border-top: 1px solid var(--footerHeaderBorderColor); }
.page-footer .hf-container > div { flex: 1; white-space: nowrap; overflow: hidden; }
.page-footer .footer-content-left { text-align: left; margin-right: 14px; }
.page-footer .footer-content { text-align: center; }
.page-footer .footer-content-right { text-align: right; margin-left: 14px; }
.page-footer.single .footer-content-left,
.page-footer.single .footer-content-right { display: none; }
`

const HF_TABLE_START = '<table class="page-container">'
const HF_TABLE_END = '</table>'
const HF_TABLE_FOOTER = `<tfoot class="page-footer-fake"><tr><td>
  <div class="hf-container">&nbsp;</div>
</td></tr></tfoot>`

const styledClass = (value: boolean | undefined): string => {
  if (value === undefined) return ''
  return value ? ' styled' : ' simple'
}

const createTableHeader = (header: HeaderFooterPart, headerFooterStyled?: boolean): string => {
  const { type, left = '', center = '', right = '' } = header
  const headerClass = (type === 1 ? 'single' : '') + styledClass(headerFooterStyled)
  return `<thead class="page-header ${headerClass}"><tr><th>
  <div class="hf-container">
    <div class="header-content-left">${left}</div>
    <div class="header-content">${center}</div>
    <div class="header-content-right">${right}</div>
  </div>
</th></tr></thead>`
}

const createRealFooter = (footer: HeaderFooterPart, headerFooterStyled?: boolean): string => {
  const { type, left = '', center = '', right = '' } = footer
  const footerClass = (type === 1 ? 'single' : '') + styledClass(headerFooterStyled)
  return `<div class="page-footer ${footerClass}">
  <div class="hf-container">
    <div class="footer-content-left">${left}</div>
    <div class="footer-content">${center}</div>
    <div class="footer-content-right">${right}</div>
  </div>
</div>`
}

const createTableBody = (article: string): string =>
  `<tbody><tr><td>
  <div class="main-container">
    ${article}
  </div>
</td></tr></tbody>`

// Match a standalone `[TOC]` line (mirrors legacy marked TOC block token).
const TOC_REG = /^ {0,3}\[TOC\] *$/im

// Match the `src="…"` of an <img> tag in the (already sanitized, double-quoted)
// engine output, so relative image paths can be rewritten to absolute `file://`
// URLs. A string rewrite avoids re-serializing the whole article DOM (which
// holds rendered KaTeX / diagram SVG).
const IMG_SRC_REG = /(<img\b[^>]*?\ssrc=")([^"]*)(")/gi

/**
 * Rewrite relative / absolute-local `<img src>` to absolute `file://` URLs so a
 * saved styled-HTML document still resolves its images after it is moved out of
 * the source folder (legacy muyajs `correctImageSrc` parity, issue 230). Remote
 * URLs and `data:` URIs are left untouched. Idempotent: a `file://` src is left
 * as-is, so the PDF / print path (which rewrites again via printService) is a
 * no-op the second time.
 */
const rewriteImageSrcs = (html: string): string =>
  html.replace(IMG_SRC_REG, (match, pre: string, src: string, post: string) => {
    const resolved = resolveLocalImageSrc(src)
    return resolved === src ? match : `${pre}${resolved}${post}`
  })

/**
 * Build a styled, standalone HTML document equivalent to legacy muyajs
 * `exportStyledHTML`. Renders markdown through the new engine, injects the TOC
 * at the `[TOC]` marker, and — when a header/footer is supplied — wraps the
 * article in the page-container table for paged PDF / print export.
 */
export const exportStyledHTML = async(
  muya: Muya,
  markdown: string,
  options: ExportStyledHtmlOptions = {}
): Promise<string> => {
  const { title = '', toc = '', header, footer, headerFooterStyled } = options
  let { extraCss = '' } = options

  // The header/footer page table needs its own stylesheet — fold it into
  // extraCss (which `generate` injects into <head>) up front so we only render
  // the document once.
  const appendHeaderFooter = !!header || !!footer
  if (appendHeaderFooter) {
    extraCss = extraCss ? HEADER_FOOTER_CSS + extraCss : HEADER_FOOTER_CSS
  }

  // Render the engine's full HTML document. We re-extract its <article> body so
  // we can inject the TOC / header-footer, then re-emit the document shell.
  const fullDoc = await new MarkdownToHtml(markdown, muya).generate({ title, extraCSS: extraCss })

  // Pull out the rendered <article class="markdown-body">…</article> body.
  const articleMatch = /<article class="markdown-body">([\s\S]*)<\/article>/.exec(fullDoc)
  let article = articleMatch ? articleMatch[1] : fullDoc

  // Resolve relative image paths to absolute file:// URLs so the saved document
  // still shows its images when opened from a different folder (issue 230).
  article = rewriteImageSrcs(article)

  // Inject the TOC at the `[TOC]` marker (legacy behaviour: only appears when
  // the document explicitly contains `[TOC]`). The marker is rendered as a
  // paragraph by marked, so replace the rendered `<p>[TOC]</p>` first, falling
  // back to a raw `[TOC]` if present.
  if (toc) {
    if (/<p>\s*\[TOC\]\s*<\/p>/i.test(article)) {
      article = article.replace(/<p>\s*\[TOC\]\s*<\/p>/i, toc)
    } else if (TOC_REG.test(article)) {
      article = article.replace(TOC_REG, toc)
    }
  }

  let bodyHtml: string
  if (!appendHeaderFooter) {
    bodyHtml = `<article class="markdown-body">${article}</article>`
  } else {
    let output = HF_TABLE_START
    if (header) output += createTableHeader(header, headerFooterStyled)
    if (footer) {
      output += HF_TABLE_FOOTER
      output = createRealFooter(footer, headerFooterStyled) + output
    }
    output += createTableBody(`<article class="markdown-body">${article}</article>`)
    output += HF_TABLE_END
    bodyHtml = sanitize(output, EXPORT_DOMPURIFY_CONFIG) as string
  }

  // Re-emit the engine document shell with the (possibly augmented) body.
  return fullDoc.replace(/<body>[\s\S]*<\/body>/, `<body>\n  ${bodyHtml}\n</body>`)
}
