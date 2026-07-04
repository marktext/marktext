// The fenced info string's first non-whitespace run is the "language" used for
// syntax highlighting and the `language-*` class (CommonMark §4.5). The rest of
// the info string is preserved as-is on the block so the fence round-trips.
export function firstWordOfInfo(info: string): string {
    return info.match(/\S*/)?.[0] ?? '';
}
