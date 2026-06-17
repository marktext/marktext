// The regex uses ASCII `\w`, so CJK and emoji collapse to hyphens. A
// Unicode-aware variant would be a separate, opt-in change.
export function generateGithubSlug(text: string): string {
    return text
        .trim()
        .toLowerCase()
        .replace(/[^\w\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-');
}
