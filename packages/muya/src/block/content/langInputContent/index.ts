import type { Muya } from '../../../muya';
import type { IRenderCursor } from '../../../selection/types';
import type { ICodeBlockState } from '../../../state/types';
import type CodeBlock from '../../commonMark/codeBlock';
import { CLASS_NAMES } from '../../../config';
import { firstWordOfInfo } from '../../../utils';
import { createDiagramState, diagramTypeOfLang } from '../../../utils/diagram/fence';
import Content from '../../base/content';
import { ScrollPage } from '../../scrollPage';
import { escapeLangInputInnerHtml } from './escape';

class LangInputContent extends Content {
    public override parent: CodeBlock | null = null;

    static override blockName = 'language-input';

    static create(muya: Muya, state: ICodeBlockState) {
        const content = new LangInputContent(muya, state);

        return content;
    }

    constructor(muya: Muya, { meta }: ICodeBlockState) {
        super(muya, meta.lang);
        this.classList = [...this.classList, CLASS_NAMES.MU_LANGUAGE_INPUT];
        this.attributes.hint = muya.i18n.t('Input Language Identifier...');
        this.createDomNode();
    }

    override getAnchor() {
        return this.parent;
    }

    override update(_cursor?: IRenderCursor, highlights = []) {
        this.domNode!.innerHTML = escapeLangInputInnerHtml(this.text, highlights);
    }

    /**
     * Update this block lang and parent's lang, and show/hide language selector.
     * @param lang
     */
    private _updateLanguage(lang: string) {
        const { start, end } = this.getCursor()!;
        this.text = lang;
        this.parent!.lang = lang;
        const startOffset = Math.min(lang.length, start.offset);
        const endOffset = Math.min(lang.length, end.offset);
        this.setCursor(startOffset, endOffset, true);
        this.muya.eventCenter.emit('content-change', { block: this });
    }

    // Public entry for setting the language programmatically (e.g. pasting into
    // the language input), so the code block re-highlights and `parent.lang`
    // updates; the DOM input handlers use `_updateLanguage` directly.
    updateLanguage(lang: string): void {
        this._updateLanguage(lang);
    }

    override inputHandler() {
        const textContent = this.domNode!.textContent ?? '';
        // Store the whole info string; the language is derived as its first word
        // elsewhere (`firstWordOfInfo`). Previously this truncated at the first
        // whitespace, which dropped `title="x"` / Pandoc attributes on edit.
        this._updateLanguage(textContent);
    }

    override enterHandler(event: Event) {
        event.preventDefault();
        event.stopPropagation();

        const { parent } = this;
        parent!.lastContentInDescendant()?.setCursor(0, 0);
    }

    override blurHandler() {
        super.blurHandler();
        // Leaving the input commits the language. Deferred: blur runs inside
        // the editor's active-block setter, which the replacement's setCursor
        // would re-enter.
        Promise.resolve().then(() => this._convertToDiagramIfNeeded());
    }

    // A diagram language makes the block a diagram, as loading its ```lang
    // fence does (#5060).
    private _convertToDiagramIfNeeded() {
        const codeBlock = this.parent;
        // Detached before the microtask ran, e.g. the document was replaced.
        if (!codeBlock?.outMostBlock)
            return;

        const type = diagramTypeOfLang(firstWordOfInfo(codeBlock.lang));
        if (!type)
            return;

        const code = codeBlock.lastContentInDescendant()!;
        const caretInCode = this.muya.editor.activeContentBlock === code;
        const diagramBlock = ScrollPage.loadBlock('diagram').create(
            this.muya,
            createDiagramState(type, code.text),
        );
        codeBlock.replaceWith(diagramBlock);

        if (caretInCode)
            diagramBlock.lastContentInDescendant()?.setCursor(0, 0, true);
    }

    override backspaceHandler(event: Event) {
        const { start, end } = this.getCursor()!;
        const { text } = this;
        // The next if statement is used to fix Firefox compatibility issues
        if (start.offset === 1 && end.offset === 1 && text.length === 1) {
            event.preventDefault();
            const lang = '';
            this._updateLanguage(lang);
        }
        if (start.offset === 0 && end.offset === 0) {
            event.preventDefault();
            const cursorBlock = this.previousContentInContext();
            // The cursorBlock will be null, if the code block is the first block in doc.
            if (cursorBlock) {
                const offset = cursorBlock.text.length;
                cursorBlock.setCursor(offset, offset, true);
            }
        }
    }
}

export default LangInputContent;
