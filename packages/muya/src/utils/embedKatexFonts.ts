// Embed the KaTeX woff2 fonts as base64 data URIs into the inlined katex
// stylesheet so a saved standalone export renders math correctly offline.
//
// `katex/dist/katex.css` references its fonts with relative `url(fonts/…)`
// paths. Inlined into an exported `.html` (and rewritten to hashed bundler
// asset paths in a production build), those references resolve to nothing when
// the file is opened from an arbitrary location with no network — KaTeX then
// falls back to system fonts and every formula renders with the wrong glyphs /
// metrics. Replacing each `@font-face` src with the embedded woff2 keeps the
// export self-contained.
//
// Faces are matched by their `font-family` + `font-weight` + `font-style`
// descriptors, NOT by the `url(…)` file name: a production build appends a
// content hash to the asset file name, so the name is unreliable while the
// descriptors are stable. Only woff2 is embedded (every browser MarkText
// targets supports it); the `woff` / `ttf` fallbacks are dropped.

import KaTeX_AMS_Regular from 'katex/dist/fonts/KaTeX_AMS-Regular.woff2?inline';
import KaTeX_Caligraphic_Bold from 'katex/dist/fonts/KaTeX_Caligraphic-Bold.woff2?inline';
import KaTeX_Caligraphic_Regular from 'katex/dist/fonts/KaTeX_Caligraphic-Regular.woff2?inline';
import KaTeX_Fraktur_Bold from 'katex/dist/fonts/KaTeX_Fraktur-Bold.woff2?inline';
import KaTeX_Fraktur_Regular from 'katex/dist/fonts/KaTeX_Fraktur-Regular.woff2?inline';
import KaTeX_Main_Bold from 'katex/dist/fonts/KaTeX_Main-Bold.woff2?inline';
import KaTeX_Main_BoldItalic from 'katex/dist/fonts/KaTeX_Main-BoldItalic.woff2?inline';
import KaTeX_Main_Italic from 'katex/dist/fonts/KaTeX_Main-Italic.woff2?inline';
import KaTeX_Main_Regular from 'katex/dist/fonts/KaTeX_Main-Regular.woff2?inline';
import KaTeX_Math_BoldItalic from 'katex/dist/fonts/KaTeX_Math-BoldItalic.woff2?inline';
import KaTeX_Math_Italic from 'katex/dist/fonts/KaTeX_Math-Italic.woff2?inline';
import KaTeX_SansSerif_Bold from 'katex/dist/fonts/KaTeX_SansSerif-Bold.woff2?inline';
import KaTeX_SansSerif_Italic from 'katex/dist/fonts/KaTeX_SansSerif-Italic.woff2?inline';
import KaTeX_SansSerif_Regular from 'katex/dist/fonts/KaTeX_SansSerif-Regular.woff2?inline';
import KaTeX_Script_Regular from 'katex/dist/fonts/KaTeX_Script-Regular.woff2?inline';
import KaTeX_Size1_Regular from 'katex/dist/fonts/KaTeX_Size1-Regular.woff2?inline';
import KaTeX_Size2_Regular from 'katex/dist/fonts/KaTeX_Size2-Regular.woff2?inline';
import KaTeX_Size3_Regular from 'katex/dist/fonts/KaTeX_Size3-Regular.woff2?inline';
import KaTeX_Size4_Regular from 'katex/dist/fonts/KaTeX_Size4-Regular.woff2?inline';
import KaTeX_Typewriter_Regular from 'katex/dist/fonts/KaTeX_Typewriter-Regular.woff2?inline';

// Keyed by `${font-family}|${font-weight}|${font-style}` (family unquoted,
// weight/style lower-cased). Mirrors the @font-face table in katex.css.
const FACE_TO_DATA_URI: Record<string, string> = {
    'KaTeX_AMS|normal|normal': KaTeX_AMS_Regular,
    'KaTeX_Caligraphic|bold|normal': KaTeX_Caligraphic_Bold,
    'KaTeX_Caligraphic|normal|normal': KaTeX_Caligraphic_Regular,
    'KaTeX_Fraktur|bold|normal': KaTeX_Fraktur_Bold,
    'KaTeX_Fraktur|normal|normal': KaTeX_Fraktur_Regular,
    'KaTeX_Main|bold|normal': KaTeX_Main_Bold,
    'KaTeX_Main|bold|italic': KaTeX_Main_BoldItalic,
    'KaTeX_Main|normal|italic': KaTeX_Main_Italic,
    'KaTeX_Main|normal|normal': KaTeX_Main_Regular,
    'KaTeX_Math|bold|italic': KaTeX_Math_BoldItalic,
    'KaTeX_Math|normal|italic': KaTeX_Math_Italic,
    'KaTeX_SansSerif|bold|normal': KaTeX_SansSerif_Bold,
    'KaTeX_SansSerif|normal|italic': KaTeX_SansSerif_Italic,
    'KaTeX_SansSerif|normal|normal': KaTeX_SansSerif_Regular,
    'KaTeX_Script|normal|normal': KaTeX_Script_Regular,
    'KaTeX_Size1|normal|normal': KaTeX_Size1_Regular,
    'KaTeX_Size2|normal|normal': KaTeX_Size2_Regular,
    'KaTeX_Size3|normal|normal': KaTeX_Size3_Regular,
    'KaTeX_Size4|normal|normal': KaTeX_Size4_Regular,
    'KaTeX_Typewriter|normal|normal': KaTeX_Typewriter_Regular,
};

const FONT_FACE_BLOCK_RE = /@font-face\s*\{[^}]*\}/g;
// Each descriptor value runs up to the next `;`. Written as `:([^;]+);` (no
// leading `\s*`, no lazy quantifier) so it is linear — the value is trimmed and
// de-quoted in JS instead.
const FAMILY_RE = /font-family:([^;]+);/;
const WEIGHT_RE = /font-weight:([^;]+);/;
const STYLE_RE = /font-style:([^;]+);/;
const SRC_RE = /src:[^;]*;/;
const QUOTE_RE = /^["']|["']$/g;

function descriptor(block: string, re: RegExp, fallback: string): string {
    return (block.match(re)?.[1]?.trim().replace(QUOTE_RE, '') ?? fallback);
}

export function embedKatexFonts(css: string): string {
    return css.replace(FONT_FACE_BLOCK_RE, (block) => {
        const family = descriptor(block, FAMILY_RE, '');
        if (!family)
            return block;
        const weight = descriptor(block, WEIGHT_RE, 'normal').toLowerCase();
        const style = descriptor(block, STYLE_RE, 'normal').toLowerCase();

        const dataUri = FACE_TO_DATA_URI[`${family}|${weight}|${style}`];
        if (!dataUri)
            return block;

        return block.replace(SRC_RE, `src: url(${dataUri}) format("woff2");`);
    });
}
