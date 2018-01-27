import marked from '../parser/marked'

const exportUnstylishHtml = markdown => {
  return marked(markdown)
}

export default exportUnstylishHtml
