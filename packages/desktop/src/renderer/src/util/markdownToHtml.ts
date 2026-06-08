import { MarkdownToHtml } from '@muyajs/core'

const markdownToHtml = async(markdown: string): Promise<string> => {
  // `MarkdownToHtml#renderHtml` already wraps the output in
  // `<article class="markdown-body">…</article>`, so we return it as-is.
  return new MarkdownToHtml(markdown).renderHtml()
}

export default markdownToHtml
