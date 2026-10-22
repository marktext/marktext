import { MarkdownToHtml } from '@muyajs/core'

const markdownToHtml = async(markdown: string): Promise<string> => {
  return new MarkdownToHtml(markdown).renderHtml()
}

export default markdownToHtml
