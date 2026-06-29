/* eslint-disable no-fallthrough */
import type {
    CodeEmojiMathToken,
    TextToken,
    Token,
} from '../../inlineRenderer/types';
import type { IContentCursor, IRenderCursor } from '../../selection/types';
import type { IBulletListState, IListItemState, IOrderListState, IParagraphState } from '../../state/types';
import type { Nullable } from '../../types';
import type { IImageInfo } from '../../utils/image';
import type AtxHeading from '../commonMark/atxHeading';
import type BulletList from '../commonMark/bulletList';
import type SetextHeading from '../commonMark/setextHeading';
import type Parent from './parent';
import type TreeNode from './treeNode';
import Content from '../../block/base/content';
import { ScrollPage } from '../../block/scrollPage';
import {
    CLASS_NAMES,
    FORMAT_MARKER_MAP,
    FORMAT_TAG_MAP,
    FORMAT_TYPES,
    PARAGRAPH_STATE,
    THEMATIC_BREAK_STATE,
} from '../../config';
import { generator, tokenizer } from '../../inlineRenderer/lexer';
import Selection, { getCursorReference } from '../../selection';
import { getTextContent } from '../../selection/dom';
import { isListItemState } from '../../state/types';
import { conflict, isHTMLElement, isMouseEvent } from '../../utils';
import { correctImageSrc, encodeImageSrc, getImageInfo } from '../../utils/image';
import logger from '../../utils/logger';

interface IOffset {
    offset: number;
}

interface IOffsetWithDelta extends IOffset {
    delta: number;
}

const debug = logger('block.format:');

function isEmojiToken(token: Token): token is CodeEmojiMathToken {
    return token.type === 'emoji';
}

const INLINE_UPDATE_FRAGMENTS = [
    '(?:^|\n) {0,3}([*+-] {1,4})', // Bullet list
    '^(\\[[x ]\\] {1,4})', // Task list **match from beginning**
    '(?:^|\n) {0,3}(\\d{1,9}(?:\\.|\\)) {1,4})', // Order list
    '(?:^|\n) {0,3}(#{1,6})(?=\\s+|$)', // ATX headings
    '^[\\s\\S]+?\\n {0,3}(={3,}|-{3,})(?= +|$)', // Setext headings **match from beginning**
    '(?:^|\n) {0,3}(>).+', // Block quote
    '^( {4,})', // Indent code **match from beginning**
    // '^(\\[\\^[^\\^\\[\\]\\s]+?(?<!\\\\)\\]: )', // Footnote **match from beginning**
    '(?:^|\n) {0,3}((?:\\* *\\* *\\*|- *- *-|_ *_ *_)[ *_-]*)(?=\n|$)', // Thematic break
];

const INLINE_UPDATE_REG = new RegExp(INLINE_UPDATE_FRAGMENTS.join('|'), 'i');

// Offset of the cursor relative to a symmetric/asymmetric marker pair
// (strong/em/code/math/html_tag). `open`/`close` are the opening/closing
// marker lengths; for the symmetric inline markers they are equal.
function markeredOffset(dis: number, len: number, open: number, close: number) {
    if (dis < 0)
        return 0;
    if (dis < open)
        return -dis;
    if (dis <= len - close)
        return -open;
    if (dis <= len)
        return len - dis - open - close;
    return -open - close;
}

function linkOffset(dis: number, anchorLen: number) {
    if (dis < 1)
        return 0;
    if (dis <= 1 + anchorLen)
        return -1;
    return anchorLen - dis;
}

function imageOffset(dis: number, altLen: number) {
    if (dis < 1)
        return 0;
    if (dis < 2)
        return -1;
    if (dis <= 2 + altLen)
        return -2;
    return altLen - dis;
}

function getOffset(offset: number, token: Token) {
    const {
        range: { start, end },
        type,
    } = token;
    const dis = offset - start;
    const len = end - start;

    switch (type) {
        case 'strong':

        case 'del':

        case 'em':

        case 'inline_code':

        case 'inline_math': {
            const markerLen = type === 'strong' || type === 'del' ? 2 : 1;
            return markeredOffset(dis, len, markerLen, markerLen);
        }

        case 'html_tag': {
            const { tag } = token;
            // handle underline, sup, sub
            return markeredOffset(
                dis,
                len,
                FORMAT_TAG_MAP[tag].open.length,
                FORMAT_TAG_MAP[tag].close.length,
            );
        }

        case 'link':
            return linkOffset(dis, token.anchor.length);

        case 'image':
            return imageOffset(dis, token.alt.length);
    }
}

function clearFormat(token: Token, cursor: IContentCursor) {
    switch (token.type) {
        case 'strong':

        case 'del':

        case 'em':

        case 'link':

        case 'html_tag': {
            // underline, sub, sup
            const { parent, children } = token;
            const index = parent.indexOf(token);
            parent.splice(index, 1, ...(children as Token[]));

            break;
        }

        case 'image': {
            const { parent, range } = token;
            const index = parent.indexOf(token);
            const newToken: TextToken = {
                type: 'text',
                raw: token.alt,
                content: token.alt, // maybe src is better?
                parent,
                range, // the range is wrong, but it will not be used.
            };

            parent.splice(index, 1, newToken);

            break;
        }

        case 'inline_math':

        case 'inline_code': {
            const { parent, range } = token;
            const index = parent.indexOf(token);
            const newToken: TextToken = {
                type: 'text',
                raw: token.content,
                content: token.content,
                parent,
                range, // the range is wrong, but it will not be used.
            };

            parent.splice(index, 1, newToken);

            break;
        }
    }

    const start = cursor.start as IOffsetWithDelta;
    const end = cursor.end as IOffsetWithDelta;

    if (start) {
        const deltaStart = getOffset(start.offset, token)!;
        start.delta += deltaStart;
    }

    if (end) {
        const deltaEnd = getOffset(end.offset, token)!;
        end.delta += deltaEnd;
    }
}

function checkTokenIsInlineFormat(token: Token) {
    const { type } = token;

    if (FORMAT_TYPES.includes(type))
        return true;

    if (type === 'html_tag')
        return /^(?:u|sub|sup|mark)$/i.test(token.tag);

    return false;
}

class Format extends Content {
    static override blockName = 'format';

    protected override get autoPairType() {
        return 'format';
    }

    private _checkCursorInTokenType(
        text: string,
        offset: number,
        type: Token['type'],
    ): Nullable<Token> {
        const tokens = tokenizer(text, {
            hasBeginRules: false,
            options: this.muya.options,
        });

        let result = null;

        const travel = (tokens: Token[]) => {
            for (const token of tokens) {
                if (token.range.start > offset)
                    break;

                if (
                    token.type === type
                    && offset > token.range.start
                    && offset < token.range.end
                ) {
                    result = token;
                    break;
                }
                else if ('children' in token && Array.isArray(token.children)) {
                    travel(token.children);
                }
            }
        };

        travel(tokens);

        return result;
    }

    private _checkNotSameToken(oldText: string, text: string) {
        const { options } = this.muya;
        const oldTokens = tokenizer(oldText, {
            options,
        });
        const tokens = tokenizer(text, {
            options,
        });

        const oldCache: Record<string, number> = {};
        const cache: Record<string, number> = {};

        for (const { type } of oldTokens) {
            if (oldCache[type])
                oldCache[type]++;
            else
                oldCache[type] = 1;
        }

        for (const { type } of tokens) {
            if (cache[type])
                cache[type]++;
            else
                cache[type] = 1;
        }

        if (Object.keys(oldCache).length !== Object.keys(cache).length)
            return true;

        for (const key of Object.keys(oldCache)) {
            if (!cache[key] || oldCache[key] !== cache[key])
                return true;
        }

        return false;
    }

    // TODO: @JOCS remove use this.selection directly
    checkNeedRender(cursor: IRenderCursor = { anchor: this.selection.anchor ?? undefined, focus: this.selection.focus ?? undefined }) {
        const { labels } = this.inlineRenderer;
        const { text } = this;
        const { start: cStart, end: cEnd, anchor, focus } = cursor;
        const anchorOffset = cStart ? cStart.offset : anchor?.offset;
        const focusOffset = cEnd ? cEnd.offset : focus?.offset;
        if (anchorOffset == null || focusOffset == null)
            return false;
        const NO_NEED_TOKEN_REG = /text|hard_line_break|soft_line_break/;

        for (const token of tokenizer(text, {
            labels,
            options: this.muya.options,
        })) {
            if (NO_NEED_TOKEN_REG.test(token.type))
                continue;

            const { start, end } = token.range;
            const textLen = text.length;

            if (
                conflict(
                    [Math.max(0, start - 1), Math.min(textLen, end + 1)],
                    [anchorOffset, anchorOffset],
                )
                || conflict(
                    [Math.max(0, start - 1), Math.min(textLen, end + 1)],
                    [focusOffset, focusOffset],
                )
            ) {
                return true;
            }
        }

        return false;
    }

    override blurHandler() {
        super.blurHandler();
        const needRender = this.checkNeedRender();
        if (needRender)
            this.update();
    }

    /**
     * Update emoji text if cursor is in emoji syntax.
     * @param {string} text emoji text
     */
    setEmoji(text: string) {
    // TODO: @JOCS remove use this.selection directly.
        const { anchor } = this.selection;
        const editEmoji = this._checkCursorInTokenType(
            this.text,
            anchor!.offset,
            'emoji',
        );

        if (editEmoji) {
            const { start, end } = editEmoji.range;
            const oldText = this.text;
            this.text
                = `${oldText.substring(0, start)}:${text}:${oldText.substring(end)}`;
            const offset = start + text.length + 2;
            this.setCursor(offset, offset, true);
        }
    }

    replaceImage({ token }: IImageInfo, { alt = '', src = '', title = '' }) {
        const { type } = token;
        const { start, end } = token.range;
        const oldText = this.text;
        let imageText = '';
        if (type === 'image') {
            imageText = '![';
            if (alt)
                imageText += alt;

            imageText += '](';
            if (src)
                imageText += encodeImageSrc(src);

            if (title)
                imageText += ` "${title}"`;

            imageText += ')';
        }
        else if (type === 'html_tag') {
            const { attrs } = token;
            Object.assign(attrs, { alt, src, title });
            imageText = '<img ';

            for (const attr of Object.keys(attrs)) {
                let value = attrs[attr];
                if (value && attr === 'src')
                    value = correctImageSrc(value);

                imageText += `${attr}="${value}" `;
            }
            imageText = imageText.trim();
            imageText += ' />';
        }

        this.text
            = oldText.substring(0, start) + imageText + oldText.substring(end);

        this.update();
    }

    updateImage(
        { imageId, token }: IImageInfo,
        attrName: string,
        attrValue: string,
    ) {
    // inline/left/center/right
        const { start, end } = token.range;
        const oldText = this.text;
        let imageText = '';
        const attrs = Object.assign({}, token.attrs);
        attrs[attrName] = attrValue;

        imageText = '<img ';

        for (const attr of Object.keys(attrs)) {
            let value = attrs[attr];
            if (value && attr === 'src')
                value = correctImageSrc(value);

            imageText += `${attr}="${value}" `;
        }
        imageText = imageText.trim();
        imageText += ' />';
        this.text
            = oldText.substring(0, start) + imageText + oldText.substring(end);

        this.update();

        const selector = `#${imageId.includes('_') ? imageId : `${imageId}_${token.range.start}`
        } img`;
        // Scope the lookup to this block: identical-src images share a DOM id,
        // so a document-wide query would re-click the first occurrence. Within a
        // single block the `_${range.start}` suffix is unique.
        const image: Nullable<HTMLElement>
            = this.domNode?.querySelector<HTMLElement>(selector)
                ?? document.querySelector<HTMLElement>(selector);

        if (image)
            image.click();
    }

    // Replace the link's source text (e.g. `[Anthropic](https://…)`) with the
    // visible anchor text only (`Anthropic`), stripping the markdown / HTML
    // around it. We keep the visible text rather than substituting the URL,
    // matching the contemporary norm (Notion, GDocs, Slack).
    unlink({ range, text }: { range: { start: number; end: number } | null; text: string }) {
        if (!range)
            return;

        const oldText = this.text;
        this.text = oldText.substring(0, range.start) + text + oldText.substring(range.end);
        this.setCursor(range.start + text.length, range.start + text.length, true);
        this.muya.eventCenter.emit('muya-link-tools', { reference: null });
    }

    deleteImage({ token }: IImageInfo) {
        const oldText = this.text;
        const { start, end } = token.range;
        const { eventCenter } = this.muya;

        this.text = oldText.substring(0, start) + oldText.substring(end);
        this.setCursor(start, start, true);

        // Hide image toolbar and image transformer
        eventCenter.emit('muya-transformer', { reference: null });
        eventCenter.emit('muya-image-toolbar', { reference: null });
    }

    override clickHandler(event: Event): void {
        if (!isMouseEvent(event))
            return;

        // Handler click inline math and inline ruby html. Use `Element`, not
        // `HTMLElement` — inline-math KaTeX output is SVG, and a click that
        // lands on an `<svg>` path still has to walk up to the wrapping
        // `.mu-math-render` HTMLElement.
        const { target } = event;
        if (!(target instanceof Element))
            return;
        const inlineRuleRenderEle
            = target.closest<HTMLElement>(`.${CLASS_NAMES.MU_MATH_RENDER}`)
                || target.closest<HTMLElement>(`.${CLASS_NAMES.MU_RUBY_RENDER}`);

        if (inlineRuleRenderEle)
            return this._handleClickInlineRuleRender(event, inlineRuleRenderEle);

        // Open the footnote tool when the user clicks an inline `[^id]`
        // reference. Doesn't early-return: cursor placement below still runs
        // so the user can also edit the identifier text directly.
        const footnoteEl = target.closest<HTMLElement>(
            `.${CLASS_NAMES.MU_INLINE_FOOTNOTE_IDENTIFIER}`,
        );
        if (footnoteEl)
            this._emitFootnoteToolEvent(footnoteEl);

        requestAnimationFrame(() => {
            // TODO: @JOCS, remove use this.selection directly.
            if (event.shiftKey && this.selection.anchorBlock !== this) {
                // TODO: handle select multiple paragraphs
                return;
            }

            const currentCursor = this.getCursor();

            if (!currentCursor)
                return;

            const cursor = Object.assign({}, currentCursor, {
                block: this,
            });

            // TODO: The codes bellow maybe is wrong? and remove use this.selection directly
            const needRender
                = this.selection.anchorBlock === this
                    ? this.checkNeedRender(cursor) || this.checkNeedRender()
                    : this.checkNeedRender(cursor);

            if (needRender)
                this.update(cursor);

            this.setCursor(currentCursor.anchor.offset, currentCursor.focus.offset);

            // Check and show format picker
            if (cursor.start.offset !== cursor.end.offset) {
                const reference = getCursorReference();

                this.muya.eventCenter.emit('muya-format-picker', {
                    reference,
                    block: this,
                });
            }
        });
    }

    override keyupHandler(): void {
        if (this.isComposed)
            return;

        // TODO: @JOCS remove use this.selection directly
        const {
            anchor: oldAnchor,
            focus: oldFocus,
            isSelectionInSameBlock,
        } = this.selection;

        if (!isSelectionInSameBlock)
            return;

        const { anchor, focus } = this.getCursor()!;

        if (
            anchor.offset !== oldAnchor?.offset
            || focus.offset !== oldFocus?.offset
        ) {
            // Also check the previously committed selection (no-arg default):
            // a held arrow fires one keyup on release, so the caret can leap
            // clear of a token in a single step and leave its markers stuck
            // revealed. Mirrors the guard in `clickHandler`.
            const needUpdate = this.checkNeedRender({ anchor, focus }) || this.checkNeedRender();
            const cursor = { anchor, focus, block: this };

            if (needUpdate)
                this.update(cursor);

            this.setCursor(anchor.offset, focus.offset);
        }

        // Check not edit emoji
        const editEmoji = this._checkCursorInTokenType(
            this.text,
            anchor.offset,
            'emoji',
        );

        if (!editEmoji) {
            this.muya.eventCenter.emit('muya-emoji-picker', {
                emojiText: '',
            });
        }

        // Check and show format picker
        if (anchor.offset !== focus.offset) {
            const reference = getCursorReference();

            this.muya.eventCenter.emit('muya-format-picker', {
                reference,
                block: this,
            });
        }
    }

    override inputHandler(event: Event): void {
        // Do not use `isInputEvent` util, because compositionEnd event also
        // invoke this method — `event.inputType` may legitimately be `undefined`
        // (CompositionEvent doesn't expose it). Use `'inputType' in event` to
        // read it from whichever event shape the runtime hands us.
        const inputType = 'inputType' in event && typeof event.inputType === 'string'
            ? event.inputType
            : '';
        if (
            this.isComposed
            || /historyUndo|historyRedo/.test(inputType)
        ) {
            return;
        }

        const { domNode } = this;
        const { start, end } = this.getCursor()!;
        const textContent = getTextContent(domNode!, [
            CLASS_NAMES.MU_MATH_RENDER,
            CLASS_NAMES.MU_RUBY_RENDER,
        ]);
        const isInInlineMath = !!this._checkCursorInTokenType(
            textContent,
            start.offset,
            'inline_math',
        );
        const isInInlineCode = !!this._checkCursorInTokenType(
            textContent,
            start.offset,
            'inline_code',
        );

        let { needRender, text } = this.autoPair(
            event,
            textContent,
            start,
            end,
            isInInlineMath,
            isInInlineCode,
            'format',
        );

        if (this._checkNotSameToken(this.text, text))
            needRender = true;

        const inputData = 'data' in event && typeof event.data === 'string' ? event.data : null;
        this.muya.editor.history.markInputBoundary(inputType, inputData);

        this.text = text;

        const cursor = {
            block: this,
            anchor: {
                offset: start.offset,
            },
            focus: {
                offset: end.offset,
            },
        };

        const checkMarkedUpdate = this.checkNeedRender(cursor);

        if (checkMarkedUpdate || needRender)
            this.update(cursor);

        this.setCursor(start.offset, end.offset);
        // check edit emoji
        if (
            inputType !== 'insertFromPaste'
            && inputType !== 'deleteByCut'
        ) {
            const emojiToken = this._checkCursorInTokenType(
                this.text,
                start.offset,
                'emoji',
            );
            if (emojiToken && isEmojiToken(emojiToken)) {
                const { content: emojiText } = emojiToken;
                const reference = getCursorReference();

                this.muya.eventCenter.emit('muya-emoji-picker', {
                    reference,
                    emojiText,
                    block: this,
                });
            }
        }

        this.checkInlineUpdate();
    }

    // Re-evaluate this block's type from its text (a leading `# `, `- `, `> `…
    // promotes/demotes it). Table cells never reinterpret their text as markdown.
    checkInlineUpdate(): void {
        if (this.blockName !== 'table.cell.content')
            this._convertIfNeeded();
    }

    private _convertIfNeeded() {
        const { text } = this;

        const [
            match,
            bulletList,
            taskList,
            orderList,
            atxHeading,
            setextHeading,
            blockquote,
            indentedCodeBlock,
            thematicBreak,
        ] = text.match(INLINE_UPDATE_REG) || [];

        switch (true) {
            case !!thematicBreak
                && new Set(thematicBreak.split('').filter(i => /\S/.test(i))).size === 1:
                this._convertToThematicBreak();
                break;

            case !!bulletList:
                this._convertToList();
                break;

            case !!orderList:
                this._convertToList();
                break;

            case !!taskList:
                this._convertToTaskList();
                break;

            case !!atxHeading:
                this._convertToAtxHeading(atxHeading);
                break;

            case !!setextHeading:
                this._convertToSetextHeading(setextHeading);
                break;

            case !!blockquote:
                this._convertToBlockQuote();
                break;

            case !!indentedCodeBlock:
                this._convertToIndentedCodeBlock();
                break;

            case !match:
            default:
                this.convertToParagraph();
                break;
        }
    }

    // Thematic Break
    private _convertToThematicBreak() {
    // If the block is already thematic break, no need to update.
        if (this.parent?.blockName === 'thematic-break')
            return;

        const { hasSelection } = this;
        const { start, end } = this.getCursor()!;
        const { text, muya } = this;
        const lines = text.split('\n');
        const preParagraphLines = [];
        let thematicLine = '';
        const postParagraphLines = [];
        let thematicLineHasPushed = false;

        for (const l of lines) {
            const THEMATIC_BREAK_REG

                = / {0,3}(?:\* *\* *\*|- *- *-|_ *_ *_)[ *\-_]*$/;
            if (THEMATIC_BREAK_REG.test(l) && !thematicLineHasPushed) {
                thematicLine = l;
                thematicLineHasPushed = true;
            }
            else if (!thematicLineHasPushed) {
                preParagraphLines.push(l);
            }
            else {
                postParagraphLines.push(l);
            }
        }

        const newNodeState = Object.assign({}, THEMATIC_BREAK_STATE, {
            text: thematicLine,
        });

        if (preParagraphLines.length) {
            const preParagraphState = Object.assign({}, PARAGRAPH_STATE, {
                text: preParagraphLines.join('\n'),
            });
            const preParagraphBlock = ScrollPage.loadBlock(
                preParagraphState.name,
            ).create(muya, preParagraphState);
            this.parent!.parent!.insertBefore(preParagraphBlock, this.parent);
        }

        if (postParagraphLines.length) {
            const postParagraphState = Object.assign({}, PARAGRAPH_STATE, {
                text: postParagraphLines.join('\n'),
            });
            const postParagraphBlock = ScrollPage.loadBlock(
                postParagraphState.name,
            ).create(muya, postParagraphState);
            this.parent!.parent!.insertAfter(postParagraphBlock, this.parent);
        }

        const thematicBlock = ScrollPage.loadBlock(newNodeState.name).create(
            muya,
            newNodeState,
        );

        this.parent!.replaceWith(thematicBlock);

        if (hasSelection) {
            const thematicBreakContent = thematicBlock.children.head;
            const preParagraphTextLength = preParagraphLines.reduce(
                (acc, i) => acc + i.length + 1,
                0,
            ); // Add one, because the `\n`
            const startOffset = Math.max(0, start.offset - preParagraphTextLength);
            const endOffset = Math.max(0, end.offset - preParagraphTextLength);

            thematicBreakContent.setCursor(startOffset, endOffset, true);
        }
    }

    private _convertToList() {
        const { text, parent, muya, hasSelection } = this;
        const { preferLooseListItem } = muya.options;
        // The marker must start a line: the pre-group captures whole lines up to
        // (and including) the newline before the marker, so a `*` inside e.g.
        // `**bold**` on an earlier soft-line is never mistaken for the bullet
        // marker (#2429).
        const matches = text.match(
            /^([\s\S]*\n)? {0,3}([*+-]|\d{1,9}(?:\.|\))) {1,4}([\s\S]*)$/,
        );
        const isOrdered = /\d/.test(matches![2]);

        if (matches![1]) {
            const paragraphState: IParagraphState = {
                name: 'paragraph',
                text: matches![1].trim(),
            };
            const paragraph = ScrollPage.loadBlock(paragraphState.name).create(
                muya,
                paragraphState,
            );
            parent!.parent!.insertBefore(paragraph, parent);
        }

        const children: IListItemState[] = [
            {
                name: 'list-item',
                children: [
                    {
                        name: 'paragraph',
                        text: matches![3],
                    },
                ],
            },
        ];

        const listState: IOrderListState | IBulletListState = isOrdered
            ? {
                    name: 'order-list',
                    meta: {
                        loose: preferLooseListItem,
                        delimiter: matches![2].slice(-1),
                        start: Number(matches![2].slice(0, -1)),
                    },
                    children,
                }
            : {
                    name: 'bullet-list',
                    meta: {
                        loose: preferLooseListItem,
                        marker: matches![2],
                    },
                    children,
                };

        const list = ScrollPage.loadBlock(listState.name).create(muya, listState);
        parent!.replaceWith(list);

        const firstContent = list.firstContentInDescendant();

        if (hasSelection)
            firstContent.setCursor(0, 0, true);

        // convert `[*-+] \[[xX ]\] ` to task list.
        const TASK_LIST_REG = /^\[[x ]\] {1,4}/i;
        if (TASK_LIST_REG.test(firstContent.text))
            firstContent._convertToTaskList();
    }

    private _convertToTaskList() {
        const { text, parent, muya, hasSelection } = this;
        const { preferLooseListItem } = muya.options;
        const listItem = parent!.parent!;
        const list = listItem?.parent as BulletList;
        const matches = text.match(/^\[([x ])\] {1,4}([\s\S]*)$/i);

        if (
            !list
            || list.blockName !== 'bullet-list'
            || !parent!.isFirstChild()
            || matches == null
        ) {
            return;
        }

        const listState = {
            name: 'task-list',
            meta: {
                loose: preferLooseListItem,
                marker: list.meta.marker,
            },
            children: [
                {
                    name: 'task-list-item',
                    meta: {
                        checked: matches[1] !== ' ',
                    },
                    children: listItem.map((node) => {
                        if (node === parent) {
                            return {
                                name: 'paragraph',
                                text: matches[2],
                            };
                        }
                        else if (node.isParent()) {
                            return node.getState();
                        }
                        else {
                            // Content leaves under a list item don't carry a
                            // full state, but in practice every nested item
                            // is a Parent at runtime (paragraph / inner-list).
                            return { name: 'paragraph', text: '' };
                        }
                    }),
                },
            ],
        };

        const newTaskList = ScrollPage.loadBlock(listState.name).create(
            muya,
            listState,
        );

        switch (true) {
            case listItem.isOnlyChild():
                list.replaceWith(newTaskList);
                break;

            case listItem.isFirstChild():
                list.parent!.insertBefore(newTaskList, list);
                listItem.remove();
                break;

            case listItem.isLastChild():
                list.parent!.insertAfter(newTaskList, list);
                listItem.remove();
                break;

            default: {
                const bulletListState: IBulletListState = {
                    name: 'bullet-list',
                    meta: {
                        loose: preferLooseListItem,
                        marker: list.meta.marker,
                    },
                    children: [],
                };
                const offset = list.offset(listItem);
                list.forEachAt(offset + 1, undefined, (node) => {
                    if (node.isParent()) {
                        const childState = node.getState();
                        if (isListItemState(childState))
                            bulletListState.children.push(childState);
                    }
                    node.remove();
                });

                const bulletList = ScrollPage.loadBlock(bulletListState.name).create(
                    muya,
                    bulletListState,
                );
                list.parent!.insertAfter(newTaskList, list);
                newTaskList.parent.insertAfter(bulletList, newTaskList);
                listItem.remove();
                break;
            }
        }

        if (hasSelection)
            newTaskList.firstContentInDescendant().setCursor(0, 0, true);
    }

    // ATX Heading
    private _convertToAtxHeading(atxHeading: string) {
        const level = atxHeading.length;
        if (
            this.parent!.blockName === 'atx-heading'
            && (this.parent as AtxHeading).meta.level === level
        ) {
            return;
        }

        const { hasSelection } = this;
        const { start, end } = this.getCursor()!;
        const { text, muya } = this;
        const lines = text.split('\n');
        const preParagraphLines = [];
        let atxLine = '';
        const postParagraphLines = [];
        let atxLineHasPushed = false;

        for (const l of lines) {
            if (/^ {0,3}#{1,6}(?=\s+|$)/.test(l) && !atxLineHasPushed) {
                atxLine = l;
                atxLineHasPushed = true;
            }
            else if (!atxLineHasPushed) {
                preParagraphLines.push(l);
            }
            else {
                postParagraphLines.push(l);
            }
        }

        if (preParagraphLines.length) {
            const preParagraphState = {
                name: 'paragraph',
                text: preParagraphLines.join('\n'),
            };
            const preParagraphBlock = ScrollPage.loadBlock(
                preParagraphState.name,
            ).create(muya, preParagraphState);
            this.parent!.parent!.insertBefore(preParagraphBlock, this.parent);
        }

        if (postParagraphLines.length) {
            const postParagraphState = {
                name: 'paragraph',
                text: postParagraphLines.join('\n'),
            };
            const postParagraphBlock = ScrollPage.loadBlock(
                postParagraphState.name,
            ).create(muya, postParagraphState);
            this.parent!.parent!.insertAfter(postParagraphBlock, this.parent);
        }

        const newNodeState = {
            name: 'atx-heading',
            meta: {
                level,
            },
            text: atxLine,
        };

        const atxHeadingBlock = ScrollPage.loadBlock(newNodeState.name).create(
            muya,
            newNodeState,
        );

        this.parent!.replaceWith(atxHeadingBlock);

        if (hasSelection) {
            const atxHeadingContent = atxHeadingBlock.children.head;
            const preParagraphTextLength = preParagraphLines.reduce(
                (acc, i) => acc + i.length + 1,
                0,
            ); // Add one, because the `\n`
            const startOffset = Math.max(0, start.offset - preParagraphTextLength);
            const endOffset = Math.max(0, end.offset - preParagraphTextLength);
            atxHeadingContent.setCursor(startOffset, endOffset, true);
        }
    }

    // Setext Heading
    private _convertToSetextHeading(setextHeading: string) {
        const level = /=/.test(setextHeading) ? 1 : 2;
        if (
            this.parent?.blockName === 'setext-heading'
            && (this.parent as SetextHeading).meta.level === level
        ) {
            return;
        }

        const { hasSelection } = this;
        const { text, muya } = this;
        const lines = text.split('\n');
        const setextLines = [];
        const postParagraphLines = [];
        let setextLineHasPushed = false;

        for (const l of lines) {
            if (/^ {0,3}(?:={3,}|-{3,})(?= +|$)/.test(l) && !setextLineHasPushed)
                setextLineHasPushed = true;
            else if (!setextLineHasPushed)
                setextLines.push(l);
            else
                postParagraphLines.push(l);
        }

        const newNodeState = {
            name: 'setext-heading',
            meta: {
                level,
                underline: setextHeading,
            },
            text: setextLines.join('\n'),
        };

        const setextHeadingBlock = ScrollPage.loadBlock(newNodeState.name).create(
            muya,
            newNodeState,
        );

        this.parent!.replaceWith(setextHeadingBlock);

        if (postParagraphLines.length) {
            const postParagraphState = {
                name: 'paragraph',
                text: postParagraphLines.join('\n'),
            };
            const postParagraphBlock = ScrollPage.loadBlock(
                postParagraphState.name,
            ).create(muya, postParagraphState);
            setextHeadingBlock.parent.insertAfter(
                postParagraphBlock,
                setextHeadingBlock,
            );
        }

        if (hasSelection) {
            const cursorBlock = setextHeadingBlock.children.head;
            const offset = cursorBlock.text.length;
            cursorBlock.setCursor(offset, offset, true);
        }
    }

    // Block Quote
    private _convertToBlockQuote() {
        const { text, muya, hasSelection } = this;
        const { start, end } = this.getCursor()!;
        const lines = text.split('\n');
        const preParagraphLines = [];
        const quoteLines = [];
        let quoteLinesHasPushed = false;
        let delta = 0;

        for (const l of lines) {
            if (/^ {0,3}>/.test(l) && !quoteLinesHasPushed) {
                quoteLinesHasPushed = true;
                const tokens = /( *> *)(.*)/.exec(l);
                delta = tokens![1].length;
                quoteLines.push(tokens![2]);
            }
            else if (!quoteLinesHasPushed) {
                preParagraphLines.push(l);
            }
            else {
                quoteLines.push(l);
            }
        }

        let quoteParagraphState;
        if (this.blockName === 'setextheading.content') {
            quoteParagraphState = {
                name: 'setext-heading',
                meta: (this.parent as SetextHeading).meta,
                text: quoteLines.join('\n'),
            };
        }
        else if (this.blockName === 'atxheading.content') {
            quoteParagraphState = {
                name: 'atx-heading',
                meta: (this.parent as AtxHeading).meta,
                text: quoteLines.join(' '),
            };
        }
        else {
            quoteParagraphState = {
                name: 'paragraph',
                text: quoteLines.join('\n'),
            };
        }

        const newNodeState = {
            name: 'block-quote',
            children: [quoteParagraphState],
        };

        const quoteBlock = ScrollPage.loadBlock(newNodeState.name).create(
            muya,
            newNodeState,
        );

        this.parent!.replaceWith(quoteBlock);

        if (preParagraphLines.length) {
            const preParagraphState = {
                name: 'paragraph',
                text: preParagraphLines.join('\n'),
            };
            const preParagraphBlock = ScrollPage.loadBlock(
                preParagraphState.name,
            ).create(muya, preParagraphState);
            quoteBlock.parent.insertBefore(preParagraphBlock, quoteBlock);
        }

        if (hasSelection) {
            // TODO: USE `firstContentInDescendant`
            const cursorBlock = quoteBlock.children.head.children.head;
            cursorBlock.setCursor(
                Math.max(0, start.offset - delta),
                Math.max(0, end.offset - delta),
                true,
            );
        }
    }

    // Indented Code Block
    private _convertToIndentedCodeBlock() {
        const { text, muya, hasSelection } = this;
        const lines = text.split('\n');
        const codeLines = [];
        const paragraphLines = [];
        let canBeCodeLine = true;

        for (const l of lines) {
            if (/^ {4,}/.test(l) && canBeCodeLine) {
                codeLines.push(l.replace(/^ {4}/, ''));
            }
            else {
                canBeCodeLine = false;
                paragraphLines.push(l);
            }
        }

        const codeState = {
            name: 'code-block',
            meta: {
                lang: '',
                type: 'indented',
            },
            text: codeLines.join('\n'),
        };

        const codeBlock = ScrollPage.loadBlock(codeState.name).create(
            muya,
            codeState,
        );
        this.parent!.replaceWith(codeBlock);

        if (paragraphLines.length > 0) {
            const paragraphState = {
                name: 'paragraph',
                text: paragraphLines.join('\n'),
            };
            const paragraphBlock = ScrollPage.loadBlock(paragraphState.name).create(
                muya,
                paragraphState,
            );
            codeBlock.parent.insertAfter(paragraphBlock, codeBlock);
        }

        if (hasSelection) {
            const cursorBlock = codeBlock.lastContentInDescendant();
            cursorBlock.setCursor(0, 0);
        }
    }

    // Paragraph
    protected convertToParagraph(force = false) {
        if (
            !force
            && (this.parent!.blockName === 'setext-heading'
                || this.parent!.blockName === 'paragraph')
        ) {
            return;
        }

        const { text, muya, hasSelection } = this;
        const { start, end } = this.getCursor()!;

        const newNodeState = {
            name: 'paragraph',
            text,
        };

        const paragraphBlock = ScrollPage.loadBlock(newNodeState.name).create(
            muya,
            newNodeState,
        );

        this.parent!.replaceWith(paragraphBlock);

        if (hasSelection) {
            const cursorBlock = paragraphBlock.children.head;
            cursorBlock.setCursor(start.offset, end.offset, true);
        }
    }

    override backspaceHandler(event: Event): void {
        const { start, end } = this.getCursor() ?? {};
        // Let input handler to handle this case.
        if (!start || !end || start?.offset !== end?.offset)
            return;

        this.muya.editor.history.markInputBoundary('deleteContentBackward', null);

        // fix: #897 in marktext repo
        const { text } = this;
        const { footnote, superSubScript } = this.muya.options;
        const { labels } = this.inlineRenderer;
        const tokens = tokenizer(text, {
            labels,
            options: { footnote, superSubScript },
        });
        // The caret offset is unreliable when it is parked on a
        // `contenteditable=false` inline image; resolve the real offset from the
        // DOM so the scan can match the image token like any other caret.
        const offset = this._caretOffsetOnInlineImage() ?? start.offset;
        const { needRender, imageToken, referenceImageToken }
            = this._scanBackspaceTokens(tokens, offset);

        if (referenceImageToken) {
            event.preventDefault();
            event.stopPropagation();
            const { start: from, end: to } = referenceImageToken.range;
            this.text = text.substring(0, from) + text.substring(to);
            this.setCursor(from, from, true);
            return;
        }

        if (needRender) {
            event.preventDefault();
            this.text = generator(tokens);

            start.offset--;
            end.offset--;
            this.setCursor(start.offset, end.offset, true);
        }

        if (imageToken) {
            const images = this.domNode!.querySelectorAll<HTMLElement>(
                `.${CLASS_NAMES.MU_INLINE_IMAGE}`,
            );
            let imageWrapper = images[images.length - 1];
            for (const image of images) {
                if (getImageInfo(image).token.range.start === imageToken.range.start) {
                    imageWrapper = image;
                    break;
                }
            }
            this._selectInlineImage(event, imageWrapper);
        }
    }

    // Scan tokens for the one ending at the caret. Mutates the matched token's
    // `raw` for the inline-syntax-marker cases (#113) so the caller can
    // regenerate text; reports image / reference-image hits for the caller to
    // delete or select.
    private _scanBackspaceTokens(tokens: Token[], offset: number): {
        needRender: boolean;
        imageToken: Token | null;
        referenceImageToken: Token | null;
    } {
        for (const token of tokens) {
            // An inline image followed by other content: the caret lands on the
            // next node at the image's end offset. Select the whole image so the
            // next Backspace deletes it as a unit (matching muyajs interaction).
            const isImageToken
                = token.type === 'image'
                    || (token.type === 'html_tag' && token.tag === 'img');
            if (token.range.end === offset && isImageToken)
                return { needRender: false, imageToken: token, referenceImageToken: null };

            // A reference image (`![alt][ref]`) is editable marked text, so it has
            // no inline-image wrapper to select. Delete the whole token at once.
            if (token.range.end === offset && token.type === 'reference_image')
                return { needRender: false, imageToken: null, referenceImageToken: token };

            // handle delete the second marker(et:*、$) in inline syntax.(Firefox compatible)
            // Fix: https://github.com/marktext/muya/issues/113
            // for example: foo **strong**|
            if (token.range.end === offset) {
                token.raw = token.raw.substring(0, token.raw.length - 1);
                return { needRender: true, imageToken: null, referenceImageToken: null };
            }

            // If preToken is a syntax token, the the cursor is at offset 1, need to set the cursor manually.(Firefox compatible)
            // // Fix: https://github.com/marktext/muya/issues/113
            // for example: foo **strong**w|
            if (token.range.start + 1 === offset) {
                token.raw = token.raw.substring(1);
                return { needRender: true, imageToken: null, referenceImageToken: null };
            }
        }

        return { needRender: false, imageToken: null, referenceImageToken: null };
    }

    // Resolve the real caret offset when the collapsed caret is parked on a
    // trailing inline image, otherwise null. Inline images are
    // `contenteditable=false`, so the browser parks the caret on the wrapper or
    // inside the image container once nothing editable follows the image, and
    // `getCursor` then reports an offset that collapses to the image's start
    // (the image's own length is excluded). Report the image's end so the token
    // scan treats it like any other caret-after-image. When other content
    // follows the image the caret lands in that content (a reliable offset), so
    // this returns null and the raw caret offset is used.
    private _caretOffsetOnInlineImage(): number | null {
        const selection = document.getSelection();
        if (!selection || selection.rangeCount === 0 || !selection.isCollapsed)
            return null;

        const { anchorNode } = selection;
        if (!anchorNode)
            return null;

        const element = isHTMLElement(anchorNode)
            ? anchorNode
            : anchorNode.parentElement;
        const imageWrapper = element?.closest<HTMLElement>(
            `.${CLASS_NAMES.MU_INLINE_IMAGE}`,
        );
        if (
            !imageWrapper
            || !this.domNode!.contains(imageWrapper)
            || !this._isTrailingInlineImage(imageWrapper)
        ) {
            return null;
        }

        return getImageInfo(imageWrapper).token.range.end;
    }

    // Whether nothing editable follows the inline image in its content block, so
    // a caret parked on it is after it rather than before a leading image.
    private _isTrailingInlineImage(imageWrapper: HTMLElement): boolean {
        let sibling = imageWrapper.nextSibling;
        while (sibling) {
            if ((sibling.textContent ?? '').length > 0)
                return false;
            sibling = sibling.nextSibling;
        }

        return true;
    }

    // Select the whole inline image. Stop propagation so this Backspace only
    // selects; the next Backspace is handled by ImageSelection and deletes it.
    private _selectInlineImage(event: Event, imageWrapper: HTMLElement): void {
        event.preventDefault();
        event.stopPropagation();
        const imageInfo = getImageInfo(imageWrapper);
        this.muya.editor.selection.selectImage(Object.assign({}, imageInfo, {
            block: this,
        }));
        // Re-render so the inline image picks up the selected highlight class.
        this.update();
    }

    override deleteHandler(event: KeyboardEvent): void {
        const { start, end } = this.getCursor()!;
        const { text } = this;
        // Let input handler to handle this case.
        if (start.offset !== end.offset || start.offset !== text.length)
            return;

        this.muya.editor.history.markInputBoundary('deleteContentForward', null);

        const nextBlock = this.nextContentInContext();
        if (!nextBlock || nextBlock.blockName !== 'paragraph.content') {
            // If the next block is code content or table cell, nothing need to do.
            event.preventDefault();
            return;
        }

        event.preventDefault();

        const paragraphBlock = nextBlock.parent!;

        this.text = text + nextBlock.text;
        this.setCursor(start.offset, end.offset, true);

        // When the merge crosses a list-item boundary, blocks that followed the
        // next paragraph inside its item (e.g. a nested sublist) must travel up
        // with the merged text. Left behind they become the sole child of the
        // now-empty item and serialize with a doubled bullet (#1845).
        const paragraph = this.parent;
        if (paragraph && paragraphBlock.parent !== paragraph.parent) {
            const trailing: TreeNode[] = [];
            let sibling = paragraphBlock.next;
            while (sibling) {
                trailing.push(sibling);
                sibling = sibling.next;
            }

            let anchor: Parent = paragraph;
            for (const block of trailing) {
                block.insertInto(paragraph.parent!, anchor.next as Nullable<Parent>);
                anchor = block as Parent;
            }
        }

        let needRemovedBlock: Nullable<Parent> = paragraphBlock;
        while (
            needRemovedBlock
            && needRemovedBlock.isOnlyChild()
            && !needRemovedBlock.isScrollPage
        ) {
            needRemovedBlock = needRemovedBlock.parent;
        }
        needRemovedBlock!.remove();
    }

    protected shiftEnterHandler(event: Event): void {
        event.preventDefault();
        event.stopPropagation();

        const { text: oldText } = this;
        const { start, end } = this.getCursor()!;
        this.text
            = `${oldText.substring(0, start.offset)}\n${oldText.substring(end.offset)}`;
        this.setCursor(start.offset + 1, end.offset + 1, true);
    }

    override enterHandler(event: KeyboardEvent): void {
        event.preventDefault();
        this.muya.editor.history.markInputBoundary('insertParagraph', '\n');
        const { text: oldText, muya, parent } = this;
        const { start, end } = this.getCursor()!;
        this.text = oldText.substring(0, start.offset);
        const textOfNewNode = oldText.substring(end.offset);
        const newParagraphState = {
            name: 'paragraph',
            text: textOfNewNode,
        };

        const newNode = ScrollPage.loadBlock(newParagraphState.name).create(
            muya,
            newParagraphState,
        );

        parent!.parent!.insertAfter(newNode, parent);

        this.update();
        const cursorBlock = newNode.firstContentInDescendant();
        cursorBlock.setCursor(0, 0, true);
    }

    getFormatsInRange(cursor: IContentCursor | null = this.getCursor()) {
        if (cursor == null)
            return { formats: [], tokens: [], neighbors: [] };

        const { start, end } = cursor;

        const { text } = this;
        const formats = [];
        const neighbors = [];
        const tokens = tokenizer(text, {
            options: this.muya.options,
        });

        (function iterator(tks) {
            for (const token of tks) {
                if (
                    checkTokenIsInlineFormat(token)
                    && start.offset >= token.range.start
                    && end.offset <= token.range.end
                ) {
                    formats.push(token);
                }

                if (
                    checkTokenIsInlineFormat(token)
                    && ((start.offset >= token.range.start
                        && start.offset <= token.range.end)
                    || (end.offset >= token.range.start
                        && end.offset <= token.range.end)
                    || (start.offset <= token.range.start
                        && token.range.end <= end.offset))
                ) {
                    neighbors.push(token);
                }

                if ('children' in token && Array.isArray(token.children))
                    iterator(token.children);
            }
        })(tokens);

        return { formats, tokens, neighbors };
    }

    format(type: string) {
        const cursor = this.getCursor();
        if (cursor == null)
            return;

        const start = cursor.start as IOffsetWithDelta;
        const end = cursor.end as IOffsetWithDelta;

        if (start == null || end == null)
            return debug.warn('You need to special the range you want to format.');

        start.delta = end.delta = 0;
        const { formats, tokens, neighbors } = this.getFormatsInRange(cursor);

        const [currentFormats, currentNeighbors] = [formats, neighbors].map(
            item =>
                item
                    .filter((format) => {
                        return (
                            format.type === type
                            || (format.type === 'html_tag' && format.tag === type)
                        );
                    })
                    .reverse(),
        );

        // cache delta
        if (type === 'clear') {
            for (const neighbor of neighbors)
                clearFormat(neighbor, cursor);

            start.offset += start.delta;
            end.offset += end.delta;

            this.text = generator(tokens, true);
        }
        else if (currentFormats.length) {
            for (const token of currentFormats)
                clearFormat(token, cursor);

            start.offset += start.delta;
            end.offset += end.delta;
            this.text = generator(tokens, true);
        }
        else {
            if (currentNeighbors.length) {
                for (const neighbor of currentNeighbors)
                    clearFormat(neighbor, cursor);
            }

            start.offset += start.delta;
            end.offset += end.delta;
            this.text = generator(tokens, true);

            // Whitespace wrapped inside emphasis markers is invalid CommonMark
            // (`**foo **` is not right-flanking, so it renders literally), so
            // trim the selection to its non-whitespace span before wrapping.
            const selected = this.text.substring(start.offset, end.offset);
            if (selected.trim().length > 0) {
                start.offset += selected.length - selected.trimStart().length;
                end.offset -= selected.length - selected.trimEnd().length;
            }

            this._addFormat(type, { start, end });

            if (type === 'image') {
                // Show image selector when create a inline image by menu/shortcut/or just input `![]()`
                requestAnimationFrame(() => {
                    const startNode = Selection.getSelectionStart();

                    if (isHTMLElement(startNode)) {
                        const imageWrapper = startNode.closest<HTMLElement>('.mu-inline-image');

                        if (
                            imageWrapper
                            && imageWrapper.classList.contains(CLASS_NAMES.MU_EMPTY_IMAGE)
                        ) {
                            const imageInfo = getImageInfo(imageWrapper);
                            const rect = imageWrapper.getBoundingClientRect();

                            const reference = {
                                getBoundingClientRect: () => rect,
                                width: imageWrapper.offsetWidth,
                                height: imageWrapper.offsetHeight,
                            };

                            this.muya.eventCenter.emit('muya-image-selector', {
                                block: this,
                                reference,
                                imageInfo,
                            });
                        }
                    }
                });
            }
        }

        this.setCursor(start.offset, end.offset, true);
    }

    private _addFormat(
        type: string,
        { start, end }: { start: IOffset; end: IOffset },
    ) {
        switch (type) {
            case 'em':

            case 'del':

            case 'inline_code':

            case 'strong':

            case 'inline_math': {
                const MARKER = FORMAT_MARKER_MAP[type];
                const oldText = this.text;
                this.text
                    = oldText.substring(0, start.offset)
                        + MARKER
                        + oldText.substring(start.offset, end.offset)
                        + MARKER
                        + oldText.substring(end.offset);
                // Shift both offsets past the opening marker. A collapsed
                // cursor stays between the markers (toggle-then-type lands
                // INSIDE the format); a non-empty selection keeps the
                // original text selected now that it sits inside the markers.
                start.offset += MARKER.length;
                end.offset += MARKER.length;
                break;
            }

            case 'sub':

            case 'sup':

            case 'mark':

            case 'u': {
                const MARKER = FORMAT_TAG_MAP[type];
                const oldText = this.text;
                this.text
                    = oldText.substring(0, start.offset)
                        + MARKER.open
                        + oldText.substring(start.offset, end.offset)
                        + MARKER.close
                        + oldText.substring(end.offset);
                // Shift both offsets past the opening tag: a collapsed cursor
                // stays between the tags, a non-empty selection keeps the
                // wrapped text selected.
                start.offset += MARKER.open.length;
                end.offset += MARKER.open.length;
                break;
            }

            case 'link':

            case 'image': {
                const oldText = this.text;
                const anchorTextLen = end.offset - start.offset;
                this.text
                    = `${oldText.substring(0, start.offset)
                    + (type === 'link' ? '[' : '![')
                    + oldText.substring(start.offset, end.offset)
                    }]()${
                        oldText.substring(end.offset)}`;
                // put cursor between `()`
                start.offset += type === 'link' ? 3 + anchorTextLen : 4 + anchorTextLen;
                end.offset = start.offset;
                break;
            }
        }
    }

    // Click the rendering of inline syntax, such as Inline Math, and select the math formula.
    private _handleClickInlineRuleRender(
        event: Event,
        inlineRuleRenderEle: Element,
    ) {
        event.preventDefault();
        event.stopPropagation();

        const startOffset = +inlineRuleRenderEle.getAttribute('data-start')!;
        const endOffset = +inlineRuleRenderEle.getAttribute('data-end')!;

        return this.setCursor(startOffset, endOffset, true);
    }

    private _emitFootnoteToolEvent(reference: HTMLElement) {
        const identifier = reference.id.replace(/^noteref-/, '');
        const { scrollPage } = this.muya.editor;
        if (!scrollPage)
            return;

        // Collect the first definition for each identifier — duplicates in
        // the document share the same `#fn-{N}` target on the HTML side.
        const footnotes = new Map<string, unknown>();
        scrollPage.breadthFirstTraverse((node) => {
            if (node.blockName !== 'footnote')
                return;
            // Footnote blocks carry `meta: { identifier }`, but the breadth-
            // first traversal hands us the base TreeNode shape. Read via a
            // structural view rather than the `as unknown as` double-cast.
            const id = (node as TreeNode & { meta?: { identifier?: string } }).meta?.identifier;
            if (typeof id === 'string' && !footnotes.has(id))
                footnotes.set(id, node);
        });

        // Snapshot the bounding rect now: the requestAnimationFrame later in
        // `clickHandler` calls `update(cursor)`, which re-renders the inline
        // content and detaches the `<sup>` we captured. By the time the
        // FootnoteTool's deferred `show()` calls floating-ui's `autoUpdate`,
        // the original element is gone (`getBoundingClientRect()` returns
        // 0/0/0/0) and the float pins to the top-left corner of the viewport.
        // Hand the tool a static virtual reference instead — it doesn't need
        // to follow live DOM changes during a single click → choose flow.
        const rect = reference.getBoundingClientRect();
        const virtualReference = {
            getBoundingClientRect: () =>
                ({
                    x: rect.x,
                    y: rect.y,
                    top: rect.top,
                    left: rect.left,
                    right: rect.right,
                    bottom: rect.bottom,
                    width: rect.width,
                    height: rect.height,
                    toJSON: () => ({}),
                }) as DOMRect,
        };

        this.muya.eventCenter.emit('muya-footnote-tool', {
            reference: virtualReference,
            identifier,
            footnotes,
        });
    }
}

export default Format;
