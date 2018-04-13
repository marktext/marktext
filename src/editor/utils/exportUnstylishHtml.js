import createDOMPurify from 'dompurify'
import marked from '../parser/marked'
import { DOMPURIFY_CONFIG } from '../config'
import { escapeInBlockHtml } from '../utils'

const exportUnstylishHtml = markdown => {
  const DOMPurify = createDOMPurify(window)
  const html = DOMPurify.sanitize(escapeInBlockHtml(marked(markdown)), DOMPURIFY_CONFIG)
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
