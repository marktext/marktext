import marked from '../parser/marked'

const exportUnstylishHtml = markdown => {
  console.log(markdown)
  console.log(marked(markdown))
  return marked(markdown)
}

export default exportUnstylishHtml
