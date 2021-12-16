import { isValidAttribute } from '../utils/dompurify'

export const sanitizeHyperlink = rawLink => {
  if (rawLink && typeof rawLink === 'string' && isValidAttribute('a', 'href', rawLink)) {
    return rawLink
  }
  return ''
}
