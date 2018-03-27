import marked from '../parser/marked'

const exportUnstylishHtml = markdown => {
  const html = marked(markdown)
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
