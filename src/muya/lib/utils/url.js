import { isValidAttribute } from '../utils/dompurify'
import { isWin } from '../config' // __MARKTEXT_PATCH__
import { hasMarkdownExtension } from './markdownFile' // __MARKTEXT_PATCH__

export const sanitizeHyperlink = rawLink => {
  if (rawLink && typeof rawLink === 'string') {
    if (isValidAttribute('a', 'href', rawLink)) {
      return rawLink
    }

    // __MARKTEXT_PATCH__
    if (isWin && /^[a-zA-Z]:[/\\].+/.test(rawLink) && hasMarkdownExtension(rawLink)) {
      // Create and try UNC path on Windows because "C:\file.md" isn't allowed.
      const uncPath = `\\\\?\\${rawLink}`
      if (isValidAttribute('a', 'href', uncPath)) {
        return uncPath
      }
    }
    // END __MARKTEXT_PATCH__
  }
  return ''
}
