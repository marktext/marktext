/** Applies the tab newline policy before storing or comparing editor output. */
export const adjustTrailingNewlines = (
  markdown: string,
  trimTrailingNewlineOption: number
): string => {
  if (!markdown) {
    return ''
  }

  switch (trimTrailingNewlineOption) {
    case 0: {
      return trimTrailingNewlines(markdown)
    }
    case 1: {
      // Muya appends a newline even for an otherwise empty document.
      const lastIndex = markdown.length - 1
      if (markdown[lastIndex] === '\n') {
        if (markdown.length === 1) {
          return ''
        } else if (markdown[lastIndex - 1] !== '\n') {
          return markdown
        }
      }

      markdown = trimTrailingNewlines(markdown)
      if (markdown.length === 0) {
        return ''
      }
      return markdown + '\n'
    }
    default:
      return markdown
  }
}

const trimTrailingNewlines = (text: string): string => {
  return text.replace(/[\r\n]+$/, '')
}
