// Mirrors marktext's `generateGithubSlug` from `src/muya/lib/utils/url.js`
// (referenced verbatim by PR-15). The regex uses ASCII `\w`, so CJK and
// emoji collapse to hyphens — same as marktext. A Unicode-aware variant
// would be a separate, opt-in change.
export function generateGithubSlug(text: string): string {
    return text
        .trim()
        .toLowerCase()
        .replace(/[^\w\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-');
}
