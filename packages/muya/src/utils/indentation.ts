// Physical source columns include container markers when locating tab stops.
export function indentationWidth(prefix: string, startColumn = 0): number {
    let column = startColumn;
    for (const char of prefix)
        column += char === '\t' ? 4 - column % 4 : 1;
    return column - startColumn;
}

// List markers may advance to the next tab stop. Content columns must stay exact.
export function indentToTabStop(prefix: string): string {
    const column = Math.ceil(indentationWidth(prefix) / 4);
    return '\t'.repeat(column);
}

// Exact columns: complete tab stops followed by the remaining spaces.
export function indentWithTabs(columns: number, startColumn = 0): string {
    const endColumn = startColumn + columns;
    const tabs = Math.floor(endColumn / 4) - Math.floor(startColumn / 4);
    return '\t'.repeat(tabs) + ' '.repeat(tabs ? endColumn % 4 : columns);
}

export function removeIndent(value: string, columns: number, startColumn = 0): string {
    let offset = 0;
    let column = startColumn;
    const endColumn = startColumn + columns;
    while (offset < value.length && column < endColumn && /[ \t]/.test(value[offset])) {
        column += value[offset] === '\t' ? 4 - column % 4 : 1;
        offset++;
    }
    return ' '.repeat(Math.max(0, column - endColumn)) + value.slice(offset);
}
