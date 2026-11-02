import caseFolding from './caseFolding.json';

// Default Unicode 17 folding overrides Unicode 14 lowercase so supported runtimes agree.
// https://www.unicode.org/Public/17.0.0/ucd/CaseFolding.txt
const folds: Record<string, string> = caseFolding;

export function normalizeReferenceLabel(label: string): string {
    const collapsed = label.replace(/[\t\n\r\f\p{Zs}]+/gu, ' ').replace(/^ | $/g, '');
    return Array.from(collapsed, char => folds[char] ?? char.toLowerCase()).join('');
}
