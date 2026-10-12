import musicFont from '../assets/styles/fonts/NotoMusic-Regular.woff2?inline';
import musicLicense from '../assets/styles/fonts/NotoMusic_LICENSE?raw';
import mathFont from '../assets/styles/fonts/NotoSansMath-Regular.woff2?inline';
import mathLicense from '../assets/styles/fonts/NotoSansMath_LICENSE?raw';
import notationFonts from '../assets/styles/notationFonts.css?inline';

const fonts: Record<string, string> = {
    'Noto Music': musicFont,
    'Noto Sans Math': mathFont,
};

export const exportNotationFonts = `/* ${musicLicense}\n${mathLicense} */\n${notationFonts.replace(
    /@font-face\s*\{[^}]*\}/g,
    (face: string) => {
        const family = face.match(/font-family:\s*['"]([^'"]+)['"]/i)?.[1];
        return family && fonts[family]
            ? face.replace(/src:[^;]*;/i, `src: url(${fonts[family]}) format('woff2');`)
            : face;
    },
)}`;

// Export themes and font overrides must retain the offline symbol fallbacks.
export function withNotationFallbacks(css: string): string {
    return css.replace(/font-family\s*:([^;}]+)(?=[;}])/gi, (declaration, value: string) => {
        const family = value.replace(/\s*!important\s*$/i, '').trim();
        if (/^(?:inherit|initial|unset|revert|revert-layer)$/i.test(family))
            return declaration;
        const important = /!important\s*$/i.test(value) ? ' !important' : '';
        return `font-family: ${family}, 'Noto Music', 'Noto Sans Math', sans-serif${important}`;
    });
}
