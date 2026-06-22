// East-Asian Wide (W) and Fullwidth (F) code-point ranges. JavaScript's Unicode
// property escapes do not expose East_Asian_Width, so the ranges are inlined
// from the Unicode East Asian Width table. Each pair is an inclusive [start,
// end] range whose code points occupy two monospace columns.
const WIDE_RANGES: readonly [number, number][] = [
    [0x1100, 0x115F], // Hangul Jamo
    [0x2E80, 0x303E], // CJK Radicals .. Kangxi Radicals .. CJK symbols
    [0x3041, 0x33FF], // Hiragana, Katakana, CJK symbols and punctuation
    [0x3400, 0x4DBF], // CJK Unified Ideographs Extension A
    [0x4E00, 0x9FFF], // CJK Unified Ideographs
    [0xA000, 0xA4CF], // Yi Syllables / Radicals
    [0xAC00, 0xD7A3], // Hangul Syllables
    [0xF900, 0xFAFF], // CJK Compatibility Ideographs
    [0xFE10, 0xFE19], // Vertical forms
    [0xFE30, 0xFE6F], // CJK Compatibility Forms / Small Form Variants
    [0xFF00, 0xFF60], // Fullwidth Forms
    [0xFFE0, 0xFFE6], // Fullwidth signs
    [0x1F300, 0x1F64F], // Emoticons / Misc symbols and pictographs
    [0x1F900, 0x1F9FF], // Supplemental symbols and pictographs
    [0x20000, 0x3FFFD], // CJK Unified Ideographs Extension B and beyond
];

// Nonspacing (Mn) and enclosing (Me) combining marks render with zero advance.
const COMBINING_MARK = /\p{Mn}|\p{Me}/u;

// Format characters that occupy no columns (zero-width space family and BOM).
function isZeroWidth(codePoint: number): boolean {
    return (
        codePoint === 0x200B // zero width space
        || (codePoint >= 0x200C && codePoint <= 0x200F) // ZWNJ/ZWJ/marks
        || codePoint === 0xFEFF // zero width no-break space (BOM)
    );
}

function isWide(codePoint: number): boolean {
    return WIDE_RANGES.some(([start, end]) => codePoint >= start && codePoint <= end);
}

/**
 * The number of monospace columns `str` occupies. Combining marks and
 * zero-width formatting characters contribute 0; East-Asian wide / fullwidth
 * code points contribute 2; everything else contributes 1.
 *
 * Iterating with `for...of` walks the string by code point, so astral
 * characters (surrogate pairs) are measured once rather than per code unit.
 */
export default function stringWidth(str: string): number {
    let width = 0;

    for (const char of str) {
        const codePoint = char.codePointAt(0)!;

        if (isZeroWidth(codePoint) || COMBINING_MARK.test(char))
            continue;

        width += isWide(codePoint) ? 2 : 1;
    }

    return width;
}
