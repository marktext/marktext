import type { Token } from 'marked';
import { correctImageSrc } from '../image';

// Rewrite Windows drive and `\\?\` image paths to `file:///` URLs before marked
// percent-encodes the href and DOMPurify, seeing `C:` as an unknown scheme,
// drops the src (#3323). For the HTML renderers only: the editor's lexer must
// keep the paths exactly as written in the document.
export function correctImageTokenSrc(token: Token) {
    if (token.type === 'image')
        token.href = correctImageSrc(token.href);
}
