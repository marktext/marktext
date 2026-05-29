import type Content from '../block/base/content';
import type TreeNode from '../block/base/treeNode';
import type { IHighlight } from '../inlineRenderer/types';
import type { Muya } from '../muya';
import type { IMatch } from './types';
import { DEFAULT_SEARCH_OPTIONS } from '../config';
import { buildRegexValue, matchString } from '../utils/search';

export class Search {
    public value: string = '';
    public matches: IMatch[] = [];
    public index: number = -1;

    get scrollPage() {
        return this.muya.editor.scrollPage;
    }

    constructor(public muya: Muya) {}

    private _updateMatches(isClear = false) {
        const { matches, index } = this;
        let i;
        const len = matches.length;
        const matchesMap = new Map<Content, IHighlight[]>();

        for (i = 0; i < len; i++) {
            const { block, start, end } = matches[i];
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
            const isActive = highlights.some(h => h.active);

            block.update(undefined, isClear ? [] : highlights);

            if (block.parent?.active && !isActive)
                block.blurHandler();

            if (isActive && !isClear)
                block.focusHandler();
        }
    }

    private _innerReplace(matches: IMatch[], value: string) {
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
            tempText += value;
            lastEnd = end;
        }

        lastBlock.text = tempText + lastBlock.text.substring(lastEnd);
    }

    replace(replaceValue: string, opt = { isSingle: true, isRegexp: false }) {
        const { isSingle, isRegexp, ...rest } = opt;
        const options = Object.assign({}, DEFAULT_SEARCH_OPTIONS, rest);
        const { matches, value, index } = this;

        if (matches.length) {
            if (isRegexp)
                replaceValue = buildRegexValue(matches[index], replaceValue);

            if (isSingle) {
                // replace one
                this._innerReplace([matches[index]], replaceValue);
            }
            else {
                // replace all
                this._innerReplace(matches, replaceValue);
            }
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

        this.index = index;

        this._updateMatches(true);
        this._updateMatches();

        return this;
    }

    /**
     * Search value in current document.
     * @param {string} value
     * @param {object} opts
     */
    search(value: string, opts = {}) {
        const matches: IMatch[] = [];
        const options = Object.assign({}, DEFAULT_SEARCH_OPTIONS, opts);
        const { highlightIndex } = options;
        let index = -1;

        // Empty last search.
        this._updateMatches(true);

        // Highlight current search.
        if (value) {
            this.scrollPage?.depthFirstTraverse((block: TreeNode) => {
                if (block.isContent()) {
                    const { text } = block;
                    if (text && typeof text === 'string') {
                        const strMatches = matchString(text, value, options);
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

        if (highlightIndex !== -1) {
            // If set the highlight index, then highlight the highlighIndex
            index = highlightIndex;
        }
        else if (matches.length) {
            // highlight the first word that matches.
            index = 0;
        }

        Object.assign(this, { value, matches, index });

        this._updateMatches();

        return this;
    }
}
