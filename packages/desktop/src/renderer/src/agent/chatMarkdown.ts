const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

const inline = (value: string): string => {
  const escaped = escapeHtml(value)
  return escaped
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>')
}

const blocks = (source: string): string => {
  const html: string[] = []
  const lines = source.replace(/\r\n/g, '\n').split('\n')
  let list: string[] | null = null
  let paragraph: string[] = []

  const flushParagraph = (): void => {
    if (paragraph.length === 0) return
    html.push(`<p>${inline(paragraph.join('\n')).replace(/\n/g, '<br>')}</p>`)
    paragraph = []
  }
  const flushList = (): void => {
    if (!list) return
    html.push(`<ul>${list.map((item) => `<li>${inline(item)}</li>`).join('')}</ul>`)
    list = null
  }

  for (const line of lines) {
    const item = /^(?:[-*])\s+(.*)$/.exec(line)
    if (item?.[1] != null) {
      flushParagraph()
      list ??= []
      list.push(item[1])
      continue
    }
    if (line.trim() === '') {
      flushList()
      flushParagraph()
      continue
    }
    flushList()
    paragraph.push(line)
  }
  flushList()
  flushParagraph()
  return html.join('')
}

/** A small subset: paragraphs, lists, inline code, fences. Text is escaped first. */
export const renderChatMarkdown = (source: string): string => {
  const html: string[] = []
  const pattern = /```[^\n]*\n([\s\S]*?)```/g
  let cursor = 0
  for (const match of source.matchAll(pattern)) {
    const index = match.index ?? 0
    html.push(blocks(source.slice(cursor, index)))
    html.push(`<pre><code>${escapeHtml(match[1] ?? '')}</code></pre>`)
    cursor = index + match[0].length
  }
  html.push(blocks(source.slice(cursor)))
  return html.join('')
}
