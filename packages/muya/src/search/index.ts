import type Content from '../block/base/content';
import type TreeNode from '../block/base/treeNode';
import type { IHighlight } from '../inlineRenderer/types';
import type { Muya } from '../muya';
import type { IAnchorFocusInfo, ISelectionEndpoint, TSelectionState } from '../selection/types';
import type { IMatch, IReplaceOption, ISearchOption } from './types';
import { unfoldAllSections } from '../block/folding';
import { DEFAULT_SEARCH_OPTIONS } from '../config';
import { comparePaths, contentPath, resolveContent, resolveEndpoint } from '../selection/state';
import { SelectionDirection, SelectionType } from '../selection/types';
import { buildRegexValue, matchString } from '../utils/search';

type SearchPosition = Pick<IAnchorFocusInfo, 'block' | 'offset'>;

export class Search {
    private _query: string = '';
    private _options: ISearchOption = { ...DEFAULT_SEARCH_OPTIONS };
    // Query edits reuse this origin; selecting a search result must not advance it.
    private _startPosition: ISelectionEndpoint | null = null;
    private _updating = false;
    private _visible = true;
    private _dirty = false;
    // DOM identity detects highlights cleared by editing/focus even when text is unchanged.
    private _renderedMatches = new Map<Content, { text: string; highlights: IHighlight[]; firstChild: ChildNode | null }>();
    public matches: IMatch[] = [];
    public index: number = -1;

    get value() {
        return this._query;
    }

    get isUpdatingSelection(): boolean {
        return this._updating;
    }

    private get _scrollPage() {
        return this._muya.editor.scrollPage;
    }

    constructor(private _muya: Muya) {
        _muya.eventCenter.on('selection-change', ({ selection, docChanged }) => {
            if (this._updating)
                return;
            if (selection?.kind === SelectionType.TEXT)
                this._startPosition = { path: [...selection.focus.path], offset: selection.focus.offset };
            if (docChanged && this._query) {
                this._dirty = true;
                if (this._visible)
                    this.refresh();
            }
        });
    }

    private _comparePosition(a: SearchPosition, b: SearchPosition): number {
        if (a.block === b.block)
            return a.offset - b.offset;
        const first = a.block.domNode;
        const second = b.block.domNode;
        if (first && second && first !== second) {
            const order = first.compareDocumentPosition(second);
            if (order & Node.DOCUMENT_POSITION_FOLLOWING)
                return -1;
            if (order & Node.DOCUMENT_POSITION_PRECEDING)
                return 1;
        }
        return comparePaths(contentPath(a.block), contentPath(b.block)) || a.offset - b.offset;
    }

    private _isSelectedMatch(match: IMatch | undefined, start: SearchPosition, end: SearchPosition): boolean {
        return !!match && start.block === match.block && end.block === match.block
            && start.offset === match.start && end.offset === match.end;
    }

    private _restoreExternalFocus(focused: Element | null): void {
        if (focused instanceof HTMLElement && focused !== document.body && focused.isConnected
            && !this._muya.domNode.contains(focused)) {
            focused.focus({ preventScroll: true });
        }
    }

    private _selectMatch(match: IMatch) {
        const focused = document.activeElement;
        match.block.setCursor(match.start, match.end);
        this._restoreExternalFocus(focused);
    }

    private _findMatchIndex(position: SearchPosition, action: 'next' | 'previous', skipEmpty = false): number {
        for (let i = action === 'next' ? 0 : this.matches.length - 1; i >= 0 && i < this.matches.length; i += action === 'next' ? 1 : -1) {
            const match = this.matches[i];
            const offset = action === 'next' ? match.start : match.end;
            const order = this._comparePosition({ block: match.block, offset }, position);
            if (skipEmpty && match.start === match.end && order === 0)
                continue;
            if (action === 'next' ? order >= 0 : order <= 0)
                return i;
        }
        return action === 'next' ? 0 : this.matches.length - 1;
    }

    /** Hiding highlights keeps the query available for keyboard navigation. */
    setVisible(visible: boolean): this {
        if (visible === this._visible)
            return this;
        const selection = this._muya.editor.selection.getSelectionState();
        this._updating = true;
        try {
            this._visible = visible;
            if (visible && this._dirty) {
                this.refresh();
                return this;
            }
            this._updateMatches();
            if (selection)
                this._muya.editor.selection.setSelection(selection);
        }
        finally {
            this._updating = false;
        }
        return this;
    }

    // Drop match state when the document is replaced (e.g. a tab switch), so
    // stale matches don't reference the previous document's blocks (#1932).
    reset() {
        this._query = '';
        this._options = { ...DEFAULT_SEARCH_OPTIONS };
        this.matches = [];
        this.index = -1;
        this._startPosition = null;
        this._dirty = false;
        this._renderedMatches.clear();
    }

    // Limit navigation to its old/new blocks; refresh also clears blocks that lost matches.
    private _updateMatches(blocks?: Set<Content>) {
        const { matches, index } = this;
        let i;
        const len = matches.length;
        const matchesMap = new Map<Content, IHighlight[]>();

        for (i = 0; i < len; i++) {
            const { block, start, end } = matches[i];
            if (!this._visible || (blocks && !blocks.has(block)))
                continue;

            const active = i === index;
            const highlight: IHighlight = { start, end, active };
            const highlights = matchesMap.get(block);

            if (highlights) {
                highlights.push(highlight);
            }
            else {
                matchesMap.set(block, [highlight]);
            }
        }

        const targets = blocks ?? new Set([...this._renderedMatches.keys(), ...matchesMap.keys()]);
        for (const block of targets)
            this._renderHighlights(block, matchesMap.get(block) ?? []);
    }

    private _renderHighlights(block: Content, highlights: IHighlight[]): void {
        if (!block.outMostBlock) {
            this._renderedMatches.delete(block);
            return;
        }

        const previous = this._renderedMatches.get(block);
        if (!previous && !highlights.length)
            return;
        if (previous?.text === block.text && previous.firstChild === block.domNode?.firstChild
            && previous.highlights.length === highlights.length
            && highlights.every((h, i) => h.start === previous.highlights[i].start
                && h.end === previous.highlights[i].end && h.active === previous.highlights[i].active)) {
            return;
        }

        const isActive = highlights.some(h => h.active);
        block.update(undefined, highlights);

        if (block.parent?.active && !isActive)
            block.blurHandler();

        if (isActive) {
            block.focusHandler();
        }
        if (highlights.length)
            this._renderedMatches.set(block, { text: block.text, highlights, firstChild: block.domNode?.firstChild ?? null });
        else
            this._renderedMatches.delete(block);
    }

    private _innerReplace(matches: IMatch[], replacementOf: (match: IMatch) => string) {
        if (!matches.length)
            return;

        let tempText = '';
        let lastBlock = matches[0].block;
        let lastEnd = 0;

        for (const match of matches) {
            const { start, end, block } = match;
            if (lastBlock !== block) {
                if (lastBlock)
                    lastBlock.text = tempText + lastBlock.text.substring(lastEnd);

                tempText = '';
                lastEnd = 0;
                lastBlock = block;
            }

            tempText += block.text.substring(lastEnd, start);
            tempText += replacementOf(match);
            lastEnd = end;
        }

        lastBlock.text = tempText + lastBlock.text.substring(lastEnd);
    }

    replace(replaceValue: string, opt: IReplaceOption = { isSingle: true, isRegexp: false }) {
        if (!this._muya.canMutate)
            return this;
        if (this._dirty)
            this.search(this._query, { ...this._options, selectHighlight: false });
        const { isSingle, isRegexp, fromSelection, ...rest } = opt;
        const options = Object.assign({}, this._options, rest, { isRegexp });
        const { matches, index } = this;
        const value = this._query;

        if (isSingle && fromSelection && matches.length) {
            this._replaceFromSelection(replaceValue, options);
            return this;
        }

        if (matches.length) {
            this._innerReplace(
                isSingle ? [matches[index]] : matches,
                match => (isRegexp ? buildRegexValue(match, replaceValue) : replaceValue),
            );
            const highlightIndex = index < matches.length - 1 ? index : index - 1;

            this.search(value, {
                ...options,
                highlightIndex: isSingle ? highlightIndex : -1,
            });
        }

        return this;
    }

    private _replaceFromSelection(replaceValue: string, options: ISearchOption): void {
        const selection = this._muya.editor.selection.getTextSelection();
        let index = this.index;
        let selectedMatch = false;
        if (selection) {
            const forward = selection.direction !== SelectionDirection.BACKWARD;
            const start = forward ? selection.anchor : selection.focus;
            const end = forward ? selection.focus : selection.anchor;
            index = this._findMatchIndex(start, 'next');
            const match = this.matches[index];
            selectedMatch = this._isSelectedMatch(match, start, end);
        }
        if (!selectedMatch) {
            this.search(this._query, { ...options, highlightIndex: index, selectHighlight: true });
            return;
        }
        const match = this.matches[index];
        const replacement = options.isRegexp ? buildRegexValue(match, replaceValue) : replaceValue;
        const focused = document.activeElement;
        this._updating = true;
        try {
            this._innerReplace([match], () => replacement);
            const offset = match.start + replacement.length;
            // Native selection offsets must be resolved against the replacement's DOM.
            match.block.setCursor(offset, offset, true);
            this._restoreExternalFocus(focused);
            this.search(this._query, { ...options, selectHighlight: false });
            this.find('next');
        }
        finally {
            this._updating = false;
        }
    }

    find(action: 'previous' | 'next'): this {
        if (this._dirty)
            this.search(this._query, { ...this._options, selectHighlight: false });
        const { matches } = this;
        let { index } = this;
        const len = matches.length;

        if (!len)
            return this;

        const selection = this._muya.editor.selection.getTextSelection();
        if (selection) {
            const { anchor, focus } = selection;
            const forward = selection.direction !== SelectionDirection.BACKWARD;
            const start = forward ? anchor : focus;
            const end = forward ? focus : anchor;
            const active = matches[index];
            const position = action === 'next'
                ? end
                : start;
            if (this._isSelectedMatch(active, start, end)) {
                index += action === 'next' ? 1 : -1;
            }
            else {
                index = this._findMatchIndex(position, action, true);
            }
        }
        else {
            index = action === 'next' ? index + 1 : index - 1;
        }

        if (index < 0)
            index = len - 1;

        if (index >= len)
            index = 0;

        const changed = new Set<Content>([matches[index].block]);
        const prev = matches[this.index];
        if (prev)
            changed.add(prev.block);

        this.index = index;

        this._updating = true;
        try {
            this._updateMatches(changed);
            this._selectMatch(matches[index]);
        }
        finally {
            this._updating = false;
        }

        return this;
    }

    search(query: string, opts: ISearchOption = {}) {
        const focused = document.activeElement;
        const selection = this._muya.editor.selection.getSelectionState();
        if (!this._startPosition && selection?.kind === SelectionType.TEXT)
            this._startPosition = { path: [...selection.focus.path], offset: selection.focus.offset };
        this._updating = true;
        try {
            return this._search(query, opts);
        }
        finally {
            this._updating = false;
            // Restoring a DOM selection can focus the editor even without selecting a match.
            this._restoreExternalFocus(focused);
        }
    }

    private _search(query: string, opts: ISearchOption) {
        const selection = this._muya.editor.selection.getSelectionState();
        const matches: IMatch[] = [];
        this._options = Object.assign({}, DEFAULT_SEARCH_OPTIONS, opts);
        this._query = query;
        this._dirty = false;
        const { highlightIndex, selectHighlight } = this._options;

        const prevActiveMatch = this.matches[this.index];

        if (query && this._visible && this._scrollPage)
            unfoldAllSections(this._scrollPage);

        if (query) {
            this._scrollPage?.depthFirstTraverse((block: TreeNode) => {
                if (block.isContent()) {
                    const { text } = block;
                    if (text && typeof text === 'string') {
                        const strMatches = matchString(text, query, this._options);
                        matches.push(
                            ...strMatches.map(({ index, match, subMatches }) => {
                                return {
                                    block,
                                    start: index,
                                    end: index + match.length,
                                    match,
                                    subMatches,
                                };
                            }),
                        );
                    }
                }
            });
        }

        const index = this._searchIndex(matches, highlightIndex, selectHighlight ? null : selection);
        Object.assign(this, { matches, index });

        this._updateMatches();

        if (selectHighlight) {
            const activeMatch = matches[index] ?? prevActiveMatch;
            if (activeMatch?.block.outMostBlock) {
                this._selectMatch(activeMatch);
            }
        }
        else if (selection) {
            this._muya.editor.selection.setSelection(selection);
        }

        return this;
    }

    private _searchIndex(matches: IMatch[], highlightIndex: number | undefined, selection: TSelectionState | null): number {
        if (typeof highlightIndex === 'number' && highlightIndex !== -1)
            return Math.min(highlightIndex, matches.length - 1);
        if (!matches.length)
            return -1;
        if (selection?.kind === SelectionType.TEXT) {
            const anchor = resolveEndpoint(this._muya, selection.anchor);
            const focus = resolveEndpoint(this._muya, selection.focus);
            const selectedIndex = anchor && focus ? matches.findIndex(match => this._isSelectedMatch(match, anchor, focus)) : -1;
            if (selectedIndex >= 0)
                return selectedIndex;
        }
        const origin = this._startPosition;
        const block = origin ? resolveContent(this._muya, origin.path) : null;
        const start = block && origin ? { block, offset: origin.offset } : null;
        const index = start ? matches.findIndex(match => this._comparePosition({ block: match.block, offset: match.start }, start) >= 0) : 0;
        return index < 0 ? 0 : index;
    }

    /** Refresh visible results; defer hidden results until reopening or navigation. */
    refresh(): this {
        const { _query: query, _options: options, index: highlightIndex } = this;

        if (!query) {
            return this;
        }
        if (!this._visible) {
            this._dirty = true;
            return this;
        }

        this.search(query, { ...options, highlightIndex, selectHighlight: false });

        this._muya.eventCenter.emit('search-refreshed', this);

        return this;
    }
}
