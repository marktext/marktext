import type { ImageToken } from '../inlineRenderer/types';

// Decide whether an image should display in-line with surrounding text
// (no resize handles) or as a block (centered, with resize handles).
//
// Source: marktext commit d26f5092 (#1335) "resize image and toggle inline
// and block image" — the toolbar lets the user toggle the image between
// `inline` and `left/center/right` block modes. The resize bar only makes
// sense for the block modes; an inline image flows with the surrounding
// text and dragging its edges would not produce a meaningful resize.
//
// The token's `data-align` attribute carries the user's choice:
//   - `'inline'` → render inline, no resize bar.
//   - `'left' | 'center' | 'right'` → block alignment, show resize bar.
//   - absent → default block-style (centered), show resize bar.
export function isInlineImage(token: { attrs: Record<string, string | null> }): boolean {
    return token.attrs['data-align'] === 'inline';
}

export function shouldShowImageResizeBar(token: ImageToken | { attrs: Record<string, string | null> }): boolean {
    return !isInlineImage(token);
}
