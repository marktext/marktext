import type { Muya } from '../../../muya';
import type { IRenderCursor } from '../../../selection/types';
import type {
    CodeContentState,
    ICodeBlockState,
    IDiagramState,
    IFrontmatterState,
} from '../../../state/types';
import type Code from '../../commonMark/codeBlock/code';
import type HTMLPreview from '../../commonMark/html/htmlPreview';
import { CLASS_NAMES, HTML_TAGS, VOID_HTML_TAGS } from '../../../config';
import { ChangeSource } from '../../../types';
import { adjustOffset, escapeHTML, firstGraphemeLength, firstWordOfInfo, lastGraphemeLength, lineBounds } from '../../../utils';
import { computeLineCount, repositionLineNumberSpans, syncLineNumbersSpans } from '../../../utils/codeBlockLineNumbers';
import { getHighlightHtml, MARKER_HASH } from '../../../utils/highlightHTML';
import prism, { loadedLanguages, transformAliasToOrigin, walkTokens } from '../../../utils/prism/index';
import Content from '../../base/content';
import { ScrollPage } from '../../scrollPage';

function checkAutoIndent(text: string, offset: number) {
    const pairStr = text.substring(offset - 1, offset + 1);

    return /^(?:\{\}|\[\]|\(\)|><)$/.test(pairStr);
}

function getIndentSpace(text: string, offset: number) {
    const [lineStart, lineEnd] = lineBounds(text, offset);
    const match = /^(\s*)\S/.exec(text.slice(lineStart, lineEnd));

    return match ? match[1] : '';
}

// Assigning identical innerHTML replaces caret text nodes and can freeze WebKit input.
// Keep unchanged nodes alive.
function replaceIfChanged(domNode: HTMLElement, html: string) {
    if (domNode.innerHTML !== html)
        domNode.innerHTML = html;
}

function parseSelector(str = '') {
    const REG_EXP = /(#|\.)([^#.]+)/;
    let tag = '';
    let id = '';
    let className = '';
    let isVoid = false;
    let cap;

    for (const tagName of HTML_TAGS) {
        if (
            str.startsWith(tagName)
            && (!str[tagName.length] || /#|\./.test(str[tagName.length]))
        ) {
            tag = tagName;
            if ((VOID_HTML_TAGS as readonly string[]).includes(tagName))
                isVoid = true;

            str = str.substring(tagName.length);
        }
    }

    if (tag !== '') {
        cap = REG_EXP.exec(str);
        while (cap && str.length) {
            if (cap[1] === '#')
                id = cap[2];
            else
                className = cap[2];

            str = str.substring(cap[0].length);
            cap = REG_EXP.exec(str);
        }
    }

    return { tag, id, className, isVoid };
}

const LANG_HASH = {
    'html-block': 'html',
    'math-block': 'latex',
};

function hasStateMeta(
    state: CodeContentState,
): state is ICodeBlockState | IDiagramState | IFrontmatterState {
    return /code-block|diagram|frontmatter/.test(state.name);
}

class CodeBlockContent extends Content {
    private _initialLang: string;
    public override parent: Code | null = null;

    static override blockName = 'codeblock.content';

    static create(muya: Muya, state: CodeContentState) {
        const content = new CodeBlockContent(muya, state);

        return content;
    }

    // Info strings can include attributes; highlighting uses only their first word.
    private get _lang() {
        const { _codeContainer: codeContainer } = this;

        return firstWordOfInfo(codeContainer ? codeContainer.lang : this._initialLang);
    }

    private get _codeContainer() {
        return this.parent?.parent;
    }

    get outContainer() {
        const { _codeContainer: codeContainer } = this;

        return /code-block|frontmatter/.test(codeContainer!.blockName)
            ? codeContainer
            : codeContainer!.parent;
    }

    // Seeded at creation to avoid racing the preview’s initial async render.
    private _lastPreviewText: string;

    constructor(muya: Muya, state: CodeContentState) {
        super(muya, state.text);
        this._lastPreviewText = state.text;
        if (hasStateMeta(state))
            this._initialLang = state.meta.lang;
        else
            this._initialLang = LANG_HASH[state.name];

        this.classList = [...this.classList, 'mu-codeblock-content'];
        this.attributes.frontMatter = muya.i18n.t('Input Front Matter...');
        this.attributes.math = muya.i18n.t('Input Mathematical Formula...');
        this.createDomNode();
    }

    override getAnchor() {
        return this.outContainer;
    }

    private _updatePreviewIfHave(text: string) {
        // update() runs during the initial create pass before this block is
        // attached, when outContainer cannot resolve its parent chain.
        if (!this._codeContainer)
            return;
        // Repeated renders can race async diagram creation and leave its SVG unmounted.
        if (text === this._lastPreviewText)
            return;
        this._lastPreviewText = text;
        if (this.outContainer?.attachments?.length)
            (this.outContainer?.attachments?.head as HTMLPreview).update(text);
    }

    override update(_cursor?: IRenderCursor, highlights = []) {
        const { _lang: lang, text } = this;
        const parentCode = this.parent as Code | null;
        if (parentCode?.copyButton && parentCode.parent?.blockName === 'code-block')
            parentCode.copyButton.hidden = !text;
        const fullLengthLang = transformAliasToOrigin([lang])[0];
        const domNode = this.domNode!;
        const code = escapeHTML(getHighlightHtml(text, highlights, true))
            .replace(new RegExp(MARKER_HASH['<'], 'g'), '<')
            .replace(new RegExp(MARKER_HASH['>'], 'g'), '>')
            .replace(new RegExp(MARKER_HASH['"'], 'g'), '"')
            .replace(new RegExp(MARKER_HASH['\''], 'g'), '\'');

        // A final newline lays out no line of its own, so the caret after it has
        // nowhere to sit (#5114). Appended after highlighting: Prism's
        // keep-markup drops empty elements. Wrapped: Chromium puts the caret
        // just before the <br>, and (content, childIndex) would read back as
        // text offset childIndex where (wrapper, 0) reads back as the text
        // length.
        const trailingBreak = text.endsWith('\n')
            ? `<span class="${CLASS_NAMES.MU_TRAILING_BREAK}"><br></span>`
            : '';

        if (
            fullLengthLang
            && /\S/.test(code)
            && loadedLanguages.has(fullLengthLang)
        ) {
            const wrapper = document.createElement('div');
            wrapper.classList.add(`language-${fullLengthLang}`);
            wrapper.innerHTML = code;
            prism.highlightElement(wrapper, false, function (this: HTMLElement) {
                replaceIfChanged(domNode, this.innerHTML + trailingBreak);
            });
        }
        else {
            replaceIfChanged(domNode, code + trailingBreak);
        }

        this._updateLineNumbers(text);
        // Re-render the math/diagram/html preview too; undo/redo reaches this
        // block only through update(), not inputHandler (#1632).
        this._updatePreviewIfHave(text);
    }

    private _lastLineCount = -1;
    private _lineNumberResizeObserver: ResizeObserver | null = null;

    private _updateLineNumbers(text: string) {
        if (!this.muya.options.codeBlockLineNumbers)
            return;
        const wrapper = this.parent?.lineNumbersWrapper;
        if (wrapper == null)
            return;
        const count = computeLineCount(text);
        if (count !== this._lastLineCount) {
            syncLineNumbersSpans(wrapper, count);
            this._lastLineCount = count;
        }
        this._observeLineNumberResize(wrapper);
    }

    // Measure after layout so code gutters follow content, wrapping and font changes.
    private _observeLineNumberResize(wrapper: HTMLElement) {
        if (this._lineNumberResizeObserver != null || typeof ResizeObserver === 'undefined')
            return;
        const codeEl = this.domNode!;
        this._lineNumberResizeObserver = new ResizeObserver(() => {
            if (codeEl.isConnected && wrapper.isConnected)
                repositionLineNumberSpans(wrapper, codeEl);
            else
                this._lineNumberResizeObserver?.disconnect();
        });
        this._lineNumberResizeObserver.observe(codeEl);
    }

    override inputHandler(event: Event): void {
        if (this.isComposed)
            return;

        const textContent = this.domNode!.textContent!;
        const { start, end } = this.getCursor()!;
        const { text } = this.autoPair(
            event,
            textContent,
            start,
            end,
            false,
            false,
            'codeblock.content',
        );
        this.text = text;

        this._updatePreviewIfHave(text);

        this.setCursor(start!.offset, end!.offset, true);
    }

    override enterHandler(event: KeyboardEvent): void {
        event.preventDefault();

        if (event.shiftKey) {
            let cursorBlock;
            const nextContentBlock = this.nextContentInContext();
            if (nextContentBlock) {
                cursorBlock = nextContentBlock;
            }
            else {
                const newNodeState = {
                    name: 'paragraph',
                    text: '',
                };
                const newNode = ScrollPage.loadBlock(newNodeState.name).create(
                    this.muya,
                    newNodeState,
                );
                this.scrollPage?.append(newNode, ChangeSource.User);
                cursorBlock = newNode.firstChild;
            }
            const offset = adjustOffset(0, cursorBlock, event);
            cursorBlock.setCursor(offset, offset, true);

            return;
        }

        const { tabSize } = this.muya.options;
        const { start } = this.getCursor()!;
        const { text } = this;
        const autoIndent = checkAutoIndent(text, start.offset);
        const indent = getIndentSpace(text, start.offset);

        this.text
            = `${text.substring(0, start.offset)
            }\n${
                autoIndent ? `${indent + ' '.repeat(tabSize)}\n` : ''
            }${indent
            }${text.substring(start.offset)}`;

        let offset = start.offset + 1 + indent.length;

        if (autoIndent)
            offset += tabSize;

        this.setCursor(offset, offset, true);
    }

    override tabHandler(event: KeyboardEvent): void {
        event.preventDefault();
        const { start, end } = this.getCursor()!;
        const { _lang: lang, text } = this;
        const isMarkupCodeContent = /markup|html|xml|svg|mathml/.test(lang);

        if (isMarkupCodeContent) {
            const lastWordBeforeCursor
                = text.substring(0, start.offset).split(/\s+/).pop() ?? '';
            const { tag, isVoid, id, className }
                = parseSelector(lastWordBeforeCursor);

            if (tag) {
                const preText = text.substring(
                    0,
                    start.offset - lastWordBeforeCursor.length,
                );
                const postText = text.substring(end.offset);
                let html = `<${tag}`;
                let startOffset = 0;
                let endOffset = 0;

                switch (tag) {
                    case 'img':
                        html += ' alt="" src=""';
                        startOffset = endOffset = html.length - 1;
                        break;

                    case 'input':
                        html += ' type="text"';
                        startOffset = html.length - 5;
                        endOffset = html.length - 1;
                        break;

                    case 'a':
                        html += ' href=""';
                        startOffset = endOffset = html.length - 1;
                        break;

                    case 'link':
                        html += ' rel="stylesheet" href=""';
                        startOffset = endOffset = html.length - 1;
                        break;
                }

                if (id)
                    html += ` id="${id}"`;

                if (className)
                    html += ` class="${className}"`;

                html += '>';

                if (startOffset === 0 && endOffset === 0)
                    startOffset = endOffset = html.length;

                if (!isVoid)
                    html += `</${tag}>`;

                this.text = preText + html + postText;
                this.setCursor(
                    startOffset + preText.length,
                    endOffset + preText.length,
                    true,
                );
            }
            else {
                this.insertTab();
            }
        }
        else {
            this.insertTab();
        }
    }

    override backspaceHandler(event: KeyboardEvent): void {
        const { start, end } = this.getCursor()!;
        if (start.offset === end.offset && start.offset === 0) {
            event.preventDefault();
            const { text, muya } = this;
            const state = {
                name: 'paragraph',
                text,
            };
            const newNode = ScrollPage.loadBlock(state.name).create(muya, state);
            this.outContainer!.replaceWith(newNode);
            const cursorBlock = newNode.lastContentInDescendant();

            return cursorBlock.setCursor(0, 0, true);
        }

        // Ctrl/Alt/Cmd+Backspace deletes a word or line: leave it to the browser (#5239).
        if (event.ctrlKey || event.altKey || event.metaKey)
            return;

        // Firefox needs manual deletion at a newline boundary.
        if (
            start.offset === end.offset
            && this.text[start.offset - 1] === '\n'
        ) {
            event.preventDefault();
            const { text } = this;
            this.text = text.substring(0, start.offset - 1) + text.substring(start.offset);
            this._updatePreviewIfHave(this.text);
            return this.setCursor(--start.offset, --end.offset, true);
        }
        // Firefox can misplace the caret at highlighted token boundaries; delete and restore it manually.
        if (start.offset === end.offset) {
            const { _lang: lang, text } = this;
            const fullLengthLang = transformAliasToOrigin([lang])[0];
            if (fullLengthLang && /\S/.test(text) && loadedLanguages.has(fullLengthLang)) {
                const tokens = prism.tokenize(text, prism.languages[fullLengthLang]);
                let offset = start.offset;
                let code = '';
                // Remove a whole character (grapheme cluster), not one UTF-16
                // code unit: half of an emoji's surrogate pair left in the text
                // crashes the next edit with "Invalid offset - splits unicode
                // bytes" (#4926).
                let removedLength = 0;

                walkTokens(tokens, (token) => {
                    if (typeof token.content === 'string') {
                        if (token.type === 'temp-text' && offset === firstGraphemeLength(token.content)) {
                            removedLength = offset;
                            token.content = token.content.substring(removedLength);
                        }
                        else if (token.type !== 'temp-text' && offset === token.length) {
                            removedLength = lastGraphemeLength(token.content);
                            token.content = token.content.substring(0, token.length - removedLength);
                        }
                    }
                    code += token.content;
                    offset -= token.length;
                });

                if (removedLength > 0) {
                    event.preventDefault();
                    this.text = code;
                    this._updatePreviewIfHave(this.text);
                    return this.setCursor(start.offset - removedLength, end.offset - removedLength, true);
                }
            }
        }
    }

    override keyupHandler(): void {
        if (this.isComposed)
            return;

        const { anchor, focus } = this.getCursor()!;
        const { anchor: oldAnchor, focus: oldFocus } = this.selection;

        if (
            anchor.offset !== oldAnchor?.offset
            || focus.offset !== oldFocus?.offset
        ) {
            this.setCursor(anchor.offset, focus.offset);
        }
    }
}

export default CodeBlockContent;
