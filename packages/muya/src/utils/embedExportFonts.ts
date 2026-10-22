// Saved exports cannot resolve renderer asset paths. Match font descriptors
// rather than file names, which receive content hashes in production builds.

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
import NotoMusic_Regular from '../assets/styles/fonts/NotoMusic-Regular.woff2?inline';
import NotoSansMath_Regular from '../assets/styles/fonts/NotoSansMath-Regular.woff2?inline';

// Keyed by `${font-family}|${font-weight}|${font-style}` (family unquoted,
// weight/style lower-cased).
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
    'Noto Music|400|normal': NotoMusic_Regular,
    'Noto Music|normal|normal': NotoMusic_Regular,
    'Noto Sans Math|400|normal': NotoSansMath_Regular,
    'Noto Sans Math|normal|normal': NotoSansMath_Regular,
};

const FONT_FACE_BLOCK_RE = /@font-face\s*\{[^}]*\}/g;
// Match through the next semicolon and trim afterward to keep descriptor parsing linear.
const FAMILY_RE = /font-family:([^;]+);/;
const WEIGHT_RE = /font-weight:([^;]+);/;
const STYLE_RE = /font-style:([^;]+);/;
const SRC_RE = /src:[^;]*;/;
const QUOTE_RE = /^["']|["']$/g;

function descriptor(block: string, re: RegExp, fallback: string): string {
    return (block.match(re)?.[1]?.trim().replace(QUOTE_RE, '') ?? fallback);
}

export function embedExportFonts(css: string): string {
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
