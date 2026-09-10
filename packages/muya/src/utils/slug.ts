// Unicode-aware like GitHub, so CJK and accented headings keep an anchor (#5292).
export function generateGithubSlug(text: string): string {
    return text
        .trim()
        .toLowerCase()
        .replace(/[^\p{L}\p{M}\p{N}\p{Pc}\s-]/gu, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-');
}
