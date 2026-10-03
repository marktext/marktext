import type Content from '../block/base/content';
import type Parent from '../block/base/parent';
import type { IHighlight } from '../inlineRenderer/types';
import type { Nullable } from '../types';
import type { IDecoration } from './types';
import { CLASS_NAMES } from '../config';
import { splitHighlightRanges } from './splitHighlights';
import { collectLiveTextBlocks } from './textBlocks';

interface IDecorationHost {
    domNode: HTMLElement;
    editor: {
        scrollPage: Nullable<Parent>;
        searchModule: {
            matches: Array<{ block: Content; start: number; end: number }>;
            index: number;
        };
    };
}

function clamp(value: number, min: number, max: number) {
    return Math.min(Math.max(value, min), max);
}

// Comment marks stored on the editor and merged into every content repaint.
// Search highlights are arguments to `block.update` and vanish on the next
// edit; decorations have to be reapplied there, alongside whatever search
// marks that update passed in.
export class Decorations {
    private _items: IDecoration[] = [];

    constructor(private _host: IDecorationHost) {}

    reset() {
        this._items = [];
    }

    set(decorations: IDecoration[]) {
        const affected = new Set<number>();

        for (const item of this._items)
            affected.add(item.blockIndex);

        this._items = decorations.map(item => ({ ...item }));

        for (const item of this._items)
            affected.add(item.blockIndex);

        this._repaint(affected);
    }

    highlightsFor(block: Content, incoming: IHighlight[]): IHighlight[] {
        if (!this._items.length)
            return incoming;

        const index = collectLiveTextBlocks(this._host).findIndex(item => item.content === block);

        if (index < 0)
            return splitHighlightRanges(incoming);

        const textLength = block.text.length;
        const extras: IHighlight[] = [];

        for (const decoration of this._items) {
            if (decoration.blockIndex !== index)
                continue;

            const start = clamp(decoration.start, 0, textLength);
            const end = clamp(decoration.end, start, textLength);

            if (start === end)
                continue;

            extras.push({
                start,
                end,
                active: decoration.active,
                className: CLASS_NAMES.MU_COMMENT,
                dataId: decoration.id,
            });
        }

        if (!extras.length)
            return splitHighlightRanges(incoming);

        return splitHighlightRanges([...incoming, ...extras]);
    }

    scrollTo(id: string) {
        const escaped = typeof CSS !== 'undefined' && typeof CSS.escape === 'function'
            ? CSS.escape(id)
            : id.replace(/["\\]/g, '\\$&');
        const node = this._host.domNode.querySelector(
            `.${CLASS_NAMES.MU_COMMENT}[data-comment-id="${escaped}"]`,
        );

        node?.scrollIntoView({ block: 'center', inline: 'nearest' });
    }

    private _repaint(indexes: Set<number>) {
        if (!indexes.size)
            return;

        for (const item of collectLiveTextBlocks(this._host)) {
            if (!indexes.has(item.index))
                continue;

            item.content.update(undefined, this._searchHighlights(item.content));
        }
    }

    private _searchHighlights(block: Content): IHighlight[] {
        const search = this._host.editor.searchModule;
        const active = search.matches[search.index];
        const highlights: IHighlight[] = [];

        for (const match of search.matches) {
            if (match.block !== block)
                continue;

            highlights.push({
                start: match.start,
                end: match.end,
                active: match === active,
            });
        }

        return highlights;
    }
}
