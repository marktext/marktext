import type Content from '../block/base/content';
import type TreeNode from '../block/base/treeNode';
import type { IHighlight } from '../inlineRenderer/types';
import type { Muya } from '../muya';
import type { IMatch, IReplaceOption, ISearchOption } from './types';
import { DEFAULT_SEARCH_OPTIONS } from '../config';
import { buildRegexValue, matchString } from '../utils/search';

export class Search {
    private _query: string = '';
    private _options: ISearchOption = { ...DEFAULT_SEARCH_OPTIONS };
    public matches: IMatch[] = [];
    public index: number = -1;

    get value() {
        return this._query;
    }

    private get _scrollPage() {
        return this._muya.editor.scrollPage;
    }

    constructor(private _muya: Muya) {}

    // Drop match state when the document is replaced (e.g. a tab switch), so
    // stale matches don't reference the previous document's blocks (#1932).
    reset() {
        this._query = '';
        this._options = { ...DEFAULT_SEARCH_OPTIONS };
        this.matches = [];
        this.index = -1;
    }

    // `blocks` limits the re-render to those blocks; omitted, every block with
    // a match is re-rendered.
    private _updateMatches(isClear = false, blocks?: Set<Content>) {
        const { matches, index } = this;
        let i;
        const len = matches.length;
        const matchesMap = new Map<Content, IHighlight[]>();

        for (i = 0; i < len; i++) {
            const { block, start, end } = matches[i];
            if (blocks && !blocks.has(block))
                continue;

            const active = i === index;
            const highlight: IHighlight = { start, end, active };
            const highlights = matchesMap.get(block);

            if (matchesMap.has(block) && Array.isArray(highlights)) {
                highlights.push(highlight);
                matchesMap.set(block, highlights);
            }
            else {
                matchesMap.set(block, [highlight]);
            }
        }

        for (const [block, highlights] of matchesMap.entries()) {
            if (!block.outMostBlock)
                continue;

            const isActive = highlights.some(h => h.active);

            block.update(undefined, isClear ? [] : highlights);

            if (block.parent?.active && !isActive)
                block.blurHandler();

            if (isActive && !isClear)
                block.focusHandler();
        }
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
        const { isSingle, isRegexp, ...rest } = opt;
        const options = Object.assign({}, DEFAULT_SEARCH_OPTIONS, rest);
        const { matches, index } = this;
        const value = this._query;

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

    /**
     * Find preview or next value, and highlight it.
     * @param {string} action : previous or next.
     */
    find(action: 'previous' | 'next'): this {
        const { matches } = this;
        let { index } = this;
        const len = matches.length;

        if (!len)
            return this;

        index = action === 'next' ? index + 1 : index - 1;

        if (index < 0)
            index = len - 1;

        if (index >= len)
            index = 0;

        // Moving the active match only changes the blocks holding the old and
        // the new one.
        const changed = new Set<Content>([matches[index].block]);
        const prev = matches[this.index];
        if (prev)
            changed.add(prev.block);

        this.index = index;

        this._updateMatches(true, changed);
        this._updateMatches(false, changed);

        return this;
    }

    /**
     * Search value in current document.
     * @param {string} query
     * @param {object} opts
     */
    search(query: string, opts: ISearchOption = {}) {
        const matches: IMatch[] = [];
        this._options = Object.assign({}, DEFAULT_SEARCH_OPTIONS, opts);
        this._query = query;
        const { highlightIndex, selectHighlight } = this._options;
        let index = -1;

        // The currently active match, captured before it is cleared below, so a
        // `selectHighlight` request can drop the cursor back onto it when the
        // new search has no match of its own (e.g. closing the search bar).
        const prevActiveMatch = this.matches[this.index];

        // Empty last search.
        this._updateMatches(true);

        // Highlight current search.
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

        if (typeof highlightIndex === 'number' && highlightIndex !== -1) {
            // If set the highlight index, then highlight the highlighIndex
            index = Math.min(highlightIndex, matches.length - 1);
        }
        else if (matches.length) {
            // highlight the first word that matches.
            index = 0;
        }

        Object.assign(this, { matches, index });

        this._updateMatches();

        if (selectHighlight) {
            const activeMatch = matches[index] ?? prevActiveMatch;
            if (activeMatch?.block.outMostBlock) {
                const { block, start, end } = activeMatch;
                block.setCursor(start, end, true);
            }
        }

        return this;
    }

    /** Re-run the active query on the blocks a full re-render just rebuilt. */
    refresh(): this {
        const { _query: query, _options: options, index: highlightIndex } = this;

        if (!query) {
            return this;
        }

        this.reset();
        this.search(query, { ...options, highlightIndex, selectHighlight: false });

        this._muya.eventCenter.emit('search-refreshed', this);

        return this;
    }
}
