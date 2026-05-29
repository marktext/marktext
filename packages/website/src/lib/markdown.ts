import { promises as fs } from 'node:fs'
import path from 'node:path'
import matter from 'gray-matter'
import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkGfm from 'remark-gfm'
import remarkRehype from 'remark-rehype'
import rehypeSlug from 'rehype-slug'
import rehypeAutolinkHeadings from 'rehype-autolink-headings'
import rehypePrettyCode from 'rehype-pretty-code'
import rehypeRaw from 'rehype-raw'
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize'
import rehypeStringify from 'rehype-stringify'
import { visit } from 'unist-util-visit'
import { toString as hastToString } from 'hast-util-to-string'
import type { Element, Root as HastRoot, Text as HastText, ElementContent } from 'hast'
import { ALL_PAGES } from './docs-nav'

export type TocEntry = { id: string; text: string; depth: 2 | 3 }

export type DocAst = {
  html: string
  toc: TocEntry[]
  title: string | null
  lead: string | null
}

const CONTENT_ROOT = path.join(process.cwd(), 'content', 'docs')

const SANITIZE_SCHEMA: typeof defaultSchema = {
  ...defaultSchema,
  tagNames: [...(defaultSchema.tagNames ?? []), 'kbd', 'details', 'summary'],
  attributes: {
    ...defaultSchema.attributes,
    a: [...(defaultSchema.attributes?.a ?? []), 'name', 'target', 'rel'],
    h1: [...(defaultSchema.attributes?.h1 ?? []), 'align'],
    h2: [...(defaultSchema.attributes?.h2 ?? []), 'align'],
    h3: [...(defaultSchema.attributes?.h3 ?? []), 'align'],
    h4: [...(defaultSchema.attributes?.h4 ?? []), 'align'],
    h5: [...(defaultSchema.attributes?.h5 ?? []), 'align'],
    h6: [...(defaultSchema.attributes?.h6 ?? []), 'align']
  }
}

const FILE_TO_SLUG = new Map<string, string>(
  ALL_PAGES.map((p) => [p.file.toLowerCase(), '/docs/' + p.slug.join('/')])
)

export async function readDoc(file: string): Promise<string> {
  const full = path.join(CONTENT_ROOT, file)
  return fs.readFile(full, 'utf8')
}

export async function renderMarkdown(source: string, ownerFile: string): Promise<DocAst> {
  const { content } = matter(source)
  const ownerDir = path.posix.dirname(ownerFile.replace(/\\/g, '/'))
  const toc: TocEntry[] = []
  let title: string | null = null
  let lead: string | null = null

  const processed = await unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkRehype, { allowDangerousHtml: true })
    // Parse raw HTML embedded in markdown into real hast Elements, then
    // sanitize. After this point the tree contains only trusted elements;
    // every downstream plugin (rehype-pretty-code, the custom transform
    // tree) adds wrappers, copy buttons and Shiki spans that we control.
    .use(rehypeRaw)
    .use(rehypeSanitize, SANITIZE_SCHEMA)
    .use(rehypeSlug)
    .use(rehypeAutolinkHeadings, {
      behavior: 'append',
      properties: { className: ['anchor'], ariaHidden: true, tabIndex: -1 },
      content: { type: 'text', value: '#' }
    })
    .use(rehypePrettyCode, {
      theme: { dark: 'github-dark-dimmed', light: 'github-light' },
      defaultLang: 'plaintext',
      keepBackground: false
    })
    .use(() => transformTree(ownerDir, toc, (t) => (title = t), (l) => (lead = l)))
    .use(rehypeStringify)
    .process(content)

  return { html: String(processed), toc, title, lead }
}

function transformTree(
  ownerDir: string,
  toc: TocEntry[],
  setTitle: (t: string) => void,
  setLead: (l: string) => void
) {
  return (tree: HastRoot) => {
    pullTitleAndLead(tree, setTitle, setLead)

    // Pass 1 — leaf rewrites. Visits every element including descendants of
    // tables, blockquotes and code blocks (pass 2 wraps those and skips, so we
    // must rewrite hrefs / img srcs / inline-code class here first).
    visit(tree, 'element', (node, _index, parent) => {
      if ((node.tagName === 'h2' || node.tagName === 'h3') && getId(node)) {
        toc.push({
          id: getId(node)!,
          text: stripAnchor(node),
          depth: node.tagName === 'h2' ? 2 : 3
        })
      }
      if (
        node.tagName === 'code' &&
        parent?.type === 'element' &&
        parent.tagName !== 'pre'
      ) {
        addClass(node, 'inline')
      }
      if (node.tagName === 'a') {
        addClass(node, 'link')
        rewriteHref(node, ownerDir)
      }
      if (node.tagName === 'img') {
        rewriteImgSrc(node, ownerDir)
      }
    })

    // Pass 2 — structural wraps. Each match replaces the node with a wrapper
    // and returns 'skip' so the visitor doesn't recurse into the new wrapper
    // (which would re-match infinitely).
    visit(tree, 'element', (node, index, parent) => {
      if (!parent || typeof index !== 'number') return
      if (node.tagName === 'table') {
        addClass(node, 'md')
        parent.children[index] = {
          type: 'element',
          tagName: 'div',
          properties: { className: ['tbl-wrap'] },
          children: [node]
        }
        return ['skip', index + 1]
      }
      if (node.tagName === 'blockquote') {
        const callout = transformAlertBlockquote(node)
        if (callout) {
          parent.children[index] = callout
          return ['skip', index + 1]
        }
      }
      if (node.tagName === 'pre' && hasCodeChild(node)) {
        parent.children[index] = wrapCodeBlock(node)
        return ['skip', index + 1]
      }
    })
  }
}

function pullTitleAndLead(
  tree: HastRoot,
  setTitle: (t: string) => void,
  setLead: (l: string) => void
) {
  for (let i = 0; i < tree.children.length; i++) {
    const node = tree.children[i]
    if (node.type !== 'element' || node.tagName !== 'h1') continue
    setTitle(hastToString(node))
    tree.children.splice(i, 1)
    // Look for the first paragraph following the (now-removed) h1
    for (let j = i; j < tree.children.length; j++) {
      const next = tree.children[j]
      if (next.type !== 'element') continue
      if (next.tagName === 'p') {
        setLead(hastToString(next))
        tree.children.splice(j, 1)
      }
      break
    }
    break
  }
}

function getId(node: Element): string | undefined {
  const id = node.properties?.id
  return typeof id === 'string' ? id : undefined
}

function stripAnchor(node: Element): string {
  // The autolink-headings plugin appends an <a class="anchor">. Pull the text
  // from everything except that trailing anchor so the TOC label reads cleanly.
  const text = node.children
    .filter((c) => !(c.type === 'element' && hasClass(c, 'anchor')))
    .map((c) => (c.type === 'element' || c.type === 'text' ? hastToString(c as Element | HastText) : ''))
    .join('')
  return text.trim()
}

function addClass(node: Element, cls: string) {
  const props = (node.properties ??= {})
  const current = props.className
  if (Array.isArray(current)) {
    if (!current.includes(cls)) current.push(cls)
  } else if (typeof current === 'string') {
    if (!current.split(/\s+/).includes(cls)) props.className = current + ' ' + cls
  } else {
    props.className = [cls]
  }
}

function hasClass(node: ElementContent, cls: string): boolean {
  if (node.type !== 'element') return false
  const c = node.properties?.className
  if (Array.isArray(c)) return c.includes(cls)
  if (typeof c === 'string') return c.split(/\s+/).includes(cls)
  return false
}

function rewriteHref(node: Element, ownerDir: string) {
  const href = node.properties?.href
  if (typeof href !== 'string') return
  if (/^[a-z]+:\/\//i.test(href) || href.startsWith('mailto:') || href.startsWith('#')) return

  // split off the hash
  const [pathPart, hash] = href.split('#')
  if (!pathPart) {
    // pure hash — leave alone
    return
  }

  // resolve relative to ownerDir within content/docs/
  const resolved = path.posix.normalize(path.posix.join(ownerDir, pathPart))
  const lower = resolved.toLowerCase()
  const mapped = FILE_TO_SLUG.get(lower)
  if (mapped) {
    node.properties!.href = hash ? `${mapped}#${hash}` : mapped
    return
  }

  // Asset (image/file)? Surface under /docs/<path>
  if (/\.(png|jpg|jpeg|gif|svg|webp|pdf)$/i.test(resolved)) {
    node.properties!.href = '/docs/' + resolved + (hash ? `#${hash}` : '')
    return
  }

  // Otherwise leave the link alone — the dead-link check in CI will flag it.
}

function rewriteImgSrc(node: Element, ownerDir: string) {
  const src = node.properties?.src
  if (typeof src !== 'string') return
  if (/^[a-z]+:\/\//i.test(src) || src.startsWith('/')) return
  const resolved = path.posix.normalize(path.posix.join(ownerDir, src))
  node.properties!.src = '/docs/' + resolved
}

const ALERT_RE = /^\s*\[!(NOTE|TIP|WARNING|CAUTION|IMPORTANT)\]\s*/i
const ALERT_KIND: Record<string, { cls: string; label: string }> = {
  NOTE: { cls: 'note', label: 'Note' },
  TIP: { cls: 'tip', label: 'Tip' },
  WARNING: { cls: 'warn', label: 'Warning' },
  CAUTION: { cls: 'warn', label: 'Caution' },
  IMPORTANT: { cls: 'note', label: 'Important' }
}

function transformAlertBlockquote(node: Element): Element | null {
  // Find the first paragraph; if it starts with `[!NOTE]` etc., extract.
  const firstP = node.children.find((c) => c.type === 'element' && c.tagName === 'p') as
    | Element
    | undefined
  if (!firstP) return null
  const firstText = firstP.children[0]
  if (!firstText || firstText.type !== 'text') return null
  const m = firstText.value.match(ALERT_RE)
  if (!m) return null
  const kind = ALERT_KIND[m[1].toUpperCase()]
  if (!kind) return null
  // Strip the marker (and any following newline) from the leading text node.
  firstText.value = firstText.value.replace(ALERT_RE, '')
  if (firstText.value === '') firstP.children.shift()

  return {
    type: 'element',
    tagName: 'div',
    properties: { className: ['callout', kind.cls] },
    children: [
      calloutIcon(kind.cls),
      {
        type: 'element',
        tagName: 'div',
        properties: { className: ['ct-body'] },
        children: [
          { type: 'element', tagName: 'b', properties: {}, children: [{ type: 'text', value: kind.label }] },
          ...node.children
        ]
      }
    ]
  }
}

function calloutIcon(kind: string): Element {
  const path =
    kind === 'tip'
      ? 'M12 2v4M12 18v4M2 12h4M18 12h4M4.9 4.9l2.8 2.8M16.3 16.3l2.8 2.8M4.9 19.1l2.8-2.8M16.3 7.7l2.8-2.8'
      : kind === 'warn'
        ? 'M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0zM12 9v4M12 17h.01'
        : 'M12 16v-4M12 8h.01M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0z'
  return {
    type: 'element',
    tagName: 'svg',
    properties: {
      className: ['ci'],
      viewBox: '0 0 24 24',
      fill: 'none',
      stroke: 'currentColor',
      strokeWidth: 2,
      strokeLinecap: 'round',
      strokeLinejoin: 'round'
    },
    children: [{ type: 'element', tagName: 'path', properties: { d: path }, children: [] }]
  }
}

function hasCodeChild(node: Element): boolean {
  return node.children.some((c) => c.type === 'element' && c.tagName === 'code')
}

function wrapCodeBlock(pre: Element): Element {
  const code = pre.children.find((c) => c.type === 'element' && c.tagName === 'code') as
    | Element
    | undefined
  const lang =
    (typeof code?.properties?.['data-language'] === 'string' && code.properties['data-language']) ||
    (typeof pre.properties?.['data-language'] === 'string' && pre.properties['data-language']) ||
    'text'
  const raw = code ? hastToString(code) : ''

  const bar: Element = {
    type: 'element',
    tagName: 'div',
    properties: { className: ['code-bar'] },
    children: [
      { type: 'element', tagName: 'span', properties: { className: ['lang'] }, children: [{ type: 'text', value: lang }] },
      {
        type: 'element',
        tagName: 'button',
        properties: { className: ['copy-btn'], type: 'button', 'data-copy': raw, 'aria-label': 'Copy code' },
        children: [
          {
            type: 'element',
            tagName: 'svg',
            properties: {
              viewBox: '0 0 24 24',
              fill: 'none',
              stroke: 'currentColor',
              strokeWidth: 2,
              strokeLinecap: 'round',
              strokeLinejoin: 'round'
            },
            children: [
              { type: 'element', tagName: 'rect', properties: { x: 9, y: 9, width: 13, height: 13, rx: 2, ry: 2 }, children: [] },
              { type: 'element', tagName: 'path', properties: { d: 'M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1' }, children: [] }
            ]
          },
          { type: 'element', tagName: 'span', properties: { className: ['label'] }, children: [{ type: 'text', value: 'Copy' }] }
        ]
      }
    ]
  }

  return {
    type: 'element',
    tagName: 'div',
    properties: { className: ['code'] },
    children: [bar, pre]
  }
}
