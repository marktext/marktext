import { isValidAttribute } from '../utils/dompurify'
import { isWin } from '../config' // __MARKTEXT_PATCH__
import { hasMarkdownExtension } from './markdownFile' // __MARKTEXT_PATCH__

export const sanitizeHyperlink = (rawLink) => {
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

/**
 * Generate a GitHub‑style heading ID (slug) from arbitrary heading text.
 *
 * @param {string} text  The heading text, e.g. "API & Usage Examples!"
 * @return {string}      The slug, e.g. "api-usage-examples"
 */
export const generateGithubSlug = (text) => {
  return text
    .trim() // remove leading/trailing whitespace
    .toLowerCase() // lowercase all characters :contentReference[oaicite:0]{index=0}
    .replace(/[^\w\s-]/g, '') // strip anything except letters, numbers, spaces or hyphens :contentReference[oaicite:1]{index=1}
    .replace(/\s+/g, '-') // convert spaces (including runs of them) to single hyphens :contentReference[oaicite:2]{index=2}
    .replace(/-+/g, '-') // collapse multiple hyphens into one :contentReference[oaicite:3]{index=3}
}
