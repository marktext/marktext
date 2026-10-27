export function tabText(tabSize: number | 'tab'): string {
    return tabSize === 'tab' ? '\t' : ' '.repeat(tabSize);
}

export function isTabKey(event: Event): event is KeyboardEvent {
    return event instanceof KeyboardEvent && event.type === 'keydown' && event.key === 'Tab';
}

export function editTab(text: string, anchor: number, focus: number, tabSize: number | 'tab', unindent = false, forceLines = false) {
    const start = Math.min(anchor, focus);
    const end = Math.max(anchor, focus);
    const firstLine = start === 0 ? 0 : text.lastIndexOf('\n', start - 1) + 1;
    const multiLine = text.slice(start, end).includes('\n');
    if (!unindent && !multiLine && !forceLines) {
        const insert = tabText(tabSize);
        const offset = start + insert.length;
        return { text: text.slice(0, start) + insert + text.slice(end), anchor: offset, focus: offset };
    }

    const lastLine = end > start ? text.lastIndexOf('\n', end - 1) + 1 : firstLine;
    const changes: { offset: number; remove: number; insert: string }[] = [];
    let offset = firstLine;
    for (const line of text.slice(firstLine).split('\n')) {
        if (offset > lastLine || (offset === end && end > start))
            break;
        if (unindent) {
            const width = tabSize === 'tab' ? 4 : tabSize;
            const remove = line.startsWith('\t') ? 1 : Math.min(/^ */.exec(line)![0].length, width);
            if (remove)
                changes.push({ offset, remove, insert: '' });
        }
        else if (line.length) {
            changes.push({ offset, remove: 0, insert: tabText(tabSize) });
        }
        offset += line.length + 1;
    }
    const mapOffset = (point: number) => point + changes.reduce((delta, change) => {
        if (change.offset > point)
            return delta;
        return delta + change.insert.length - Math.min(change.remove, point - change.offset);
    }, 0);
    for (const change of [...changes].reverse())
        text = text.slice(0, change.offset) + change.insert + text.slice(change.offset + change.remove);

    return { text, anchor: mapOffset(anchor), focus: mapOffset(focus) };
}
