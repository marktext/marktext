import { MarkdownToHtml } from '@muyajs/core'

const MERMAID_HEAD = /^(sequenceDiagram|flowchart|graph|gantt|classDiagram|stateDiagram|journey|gitGraph|pie|erDiagram|mindmap|requirementDiagram|quadrantChart|timeline|sankey-beta|xychart-beta|block-beta|architecture-beta|packet-beta|kanban|info)\b/

// @muyajs/core's MarkdownToHtml.renderHtml() shares a module-level `marked`
// instance and re-registers its `walkTokens` callback on every call. After the
// first call, code tokens have their `lang` cleared by the accumulated
// callbacks, so the built-in `renderMermaid` (which queries
// `code.language-mermaid`) misses the blocks and the diagram source leaks
// through as plain text. Detect those by content and rewrap so a downstream
// `mermaid.run()` pass can render them.
function rewrapMermaidSource(html: string): string {
  if (!html.includes('<pre><code>')) return html
  const doc = new DOMParser().parseFromString(html, 'text/html')
  let changed = false
  for (const code of Array.from(doc.querySelectorAll('pre > code'))) {
    if (code.className && !code.classList.contains('language-mermaid')) continue
    const text = (code.textContent ?? '').trim()
    if (!MERMAID_HEAD.test(text)) continue
    const div = doc.createElement('div')
    div.className = 'mermaid'
    div.textContent = text
    code.parentElement?.replaceWith(div)
    changed = true
  }
  return changed ? doc.body.innerHTML : html
}

const markdownToHtml = async (markdown: string): Promise<string> => {
  const html = await new MarkdownToHtml(markdown).renderHtml()
  return rewrapMermaidSource(html)
}

export default markdownToHtml
