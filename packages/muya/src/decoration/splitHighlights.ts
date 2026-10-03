import type { IHighlight } from '../inlineRenderer/types';
import { CLASS_NAMES } from '../config';

// Overlapping ranges cannot be sibling spans: the later start falls inside the
// earlier span and the markup breaks. Cut every range at the others' edges so
// each character belongs to at most one span, which carries every class that
// covered it (search and comment together).
export function splitHighlightRanges(highlights: IHighlight[]): IHighlight[] {
    const ranged = highlights.filter(light => light.end > light.start);

    if (ranged.length <= 1)
        return ranged;

    const points = new Set<number>();

    for (const light of ranged) {
        points.add(light.start);
        points.add(light.end);
    }

    const bounds = [...points].sort((a, b) => a - b);
    const out: IHighlight[] = [];

    for (let i = 0; i < bounds.length - 1; i++) {
        const start = bounds[i];
        const end = bounds[i + 1];
        const covering = ranged.filter(light => light.start <= start && light.end >= end);

        if (!covering.length)
            continue;

        out.push(covering.length === 1
            ? { ...covering[0], start, end }
            : mergeCovering(start, end, covering));
    }

    return out;
}

function mergeCovering(start: number, end: number, covering: IHighlight[]): IHighlight {
    const classes: string[] = [];
    let dataId: string | undefined;
    let commentActive = false;
    let searchActive = false;
    let hasSearch = false;

    for (const light of covering) {
        if (light.className) {
            for (const name of light.className.split(/\s+/)) {
                if (name && name !== CLASS_NAMES.MU_COMMENT_ACTIVE && !classes.includes(name))
                    classes.push(name);
            }

            if (light.active)
                commentActive = true;

            if (light.dataId !== undefined && dataId === undefined)
                dataId = light.dataId;
        }
        else {
            hasSearch = true;

            if (light.active)
                searchActive = true;
        }
    }

    if (hasSearch) {
        const searchClass = searchActive ? CLASS_NAMES.MU_HIGHLIGHT : CLASS_NAMES.MU_SELECTION;

        if (!classes.includes(searchClass))
            classes.unshift(searchClass);
    }

    const merged: IHighlight = {
        start,
        end,
        active: commentActive,
    };

    if (classes.length)
        merged.className = classes.join(' ');

    if (dataId !== undefined)
        merged.dataId = dataId;

    return merged;
}
