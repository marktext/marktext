import marked from '../parser/marked'
import { EXPORT_DOMPURIFY_CONFIG } from '../config'
import { sanitize } from '../utils'

export const getSanitizeHtml = markdown => {
  const html = marked(markdown)
  return sanitize(html, EXPORT_DOMPURIFY_CONFIG)
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
