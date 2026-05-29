/**
 * Sanitize user-provided theme CSS before it is injected into a renderer that
 * runs with `webSecurity: false`.
 *
 * CSS cannot execute JavaScript, but it can trigger network requests (for
 * example `background: url(https://attacker.example/x)`), which can beacon or
 * exfiltrate. We therefore remove every construct that can load an external or
 * local resource, leaving a colours-only theme:
 *
 *   - `@import` and `@namespace` rules
 *   - `@font-face` blocks
 *   - any value using `url()`, `image-set()` / `-webkit-image-set()`, or
 *     `image()` (covers remote, `file:` and `data:` URLs)
 *
 * CSS lets identifiers be written with backslash escapes (`\75 rl(...)` is
 * `url(...)`), so escapes are decoded first - otherwise a literal-text denylist
 * is trivially bypassed. This is best-effort hardening, not a sandbox; it is the
 * reason custom themes are colours-only.
 */

/**
 * Decode CSS escape sequences to their literal characters so the denylist below
 * cannot be evaded by spelling `url`/`@import`/etc. with escapes. Hex escapes
 * are `\` + 1-6 hex digits + one optional trailing whitespace; any other `\x`
 * is the literal `x` (and `\` before a newline is a line continuation).
 */
const decodeCssEscapes = (css: string): string =>
  css.replace(/\\([0-9a-fA-F]{1,6})[ \t\r\n\f]?|\\([\s\S])/g, (_match, hex?: string, ch?: string) => {
    if (hex !== undefined) {
      const code = parseInt(hex, 16)
      if (code === 0 || code > 0x10ffff || (code >= 0xd800 && code <= 0xdfff)) return '\ufffd'
      try {
        return String.fromCodePoint(code)
      } catch {
        return '\ufffd'
      }
    }
    // `\<newline>` is a line continuation (removed); otherwise the literal char.
    return ch === '\n' || ch === '\r' || ch === '\f' ? '' : (ch ?? '')
  })

/** Strip CSS block comments. */
const stripComments = (css: string): string => css.replace(/\/\*[\s\S]*?\*\//g, '')

/**
 * Remove all resource-loading CSS from a theme stylesheet.
 *
 * @param rawCss The raw (untrusted) CSS contents.
 * @returns CSS safe to inject via `textContent` into a `<style>` element.
 */
export const sanitizeThemeCss = (rawCss: string): string => {
  // Decode escapes first so matching sees canonical identifiers, then drop
  // comments (which could otherwise hide constructs from the matchers).
  let css = stripComments(decodeCssEscapes(rawCss))
  // Resource-loading functions. Matching up to the first ')' (rather than
  // excluding ';') reliably captures data: URLs, whose value contains ';'
  // (e.g. data:image/png;base64,...); base64 and percent-encoded URLs never
  // contain a literal ')'. `image-set` must precede `image` in the alternation.
  css = css.replace(/(?:-webkit-)?(?:url|image-set|image)\s*\([^)]*\)/gi, '')
  // Resource-loading at-rules.
  css = css.replace(/@import\b[^;]*;/gi, '')
  css = css.replace(/@namespace\b[^;]*;/gi, '')
  css = css.replace(/@font-face\s*\{[^}]*\}/gi, '')
  // Defensive: legacy IE/old-Gecko resource vectors. Inert in Chromium, but
  // removed anyway so the output is safe regardless of engine.
  css = css.replace(/(?:behavior|-moz-binding)\s*:[^;}]*/gi, '')
  css = css.replace(/expression\s*\([^)]*\)/gi, '')
  return css.trim()
}
