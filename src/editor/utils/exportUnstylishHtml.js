import createDOMPurify from 'dompurify'
import marked from '../parser/marked'
import { DOMPURIFY_CONFIG } from '../config'
import { escapeInBlockHtml } from '../utils'

export const getSanitizeHtml = markdown => {
  const DOMPurify = createDOMPurify(window)
  return DOMPurify.sanitize(escapeInBlockHtml(marked(markdown)), DOMPURIFY_CONFIG)
}

const exportUnstylishHtml = markdown => {
  const html = getSanitizeHtml(markdown)
  const outputHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
</head>
<body>
  ${html}
</body>
</html>`
  return outputHtml
}

export default exportUnstylishHtml
