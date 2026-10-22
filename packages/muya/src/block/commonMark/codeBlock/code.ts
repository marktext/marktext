import type I18n from '../../../i18n';
import type { Muya } from '../../../muya';
import type { CodeContentState, TState } from '../../../state/types';
import type { Nullable } from '../../../types';
import type CodeBlock from './index';
import { fromEvent } from 'rxjs';
import copyIcon from '../../../assets/icons/copy/2.png';
import { CopyType } from '../../../clipboard/types';
import { LINE_NUMBERS_ROWS_CLASS, lineNumbersWrapperHTML } from '../../../utils/codeBlockLineNumbers';
import { showCopyFeedback } from '../../../utils/copyFeedback';
import logger from '../../../utils/logger';
import { h, toHTML } from '../../../utils/snabbdom';
import Parent from '../../base/parent';
import { ScrollPage } from '../../scrollPage';

const debug = logger('code:');

function renderCopyButton(i18n: I18n) {
    const selector = 'button.mu-code-copy';
    const iconVnode = h(
        'i.icon',
        h(
            'i.icon-inner',
            {
                style: {
                    'background': `url(${copyIcon}) no-repeat`,
                    'background-size': '100%',
                },
            },
            '',
        ),
    );

    return h(
        selector,
        {
            attrs: {
                'type': 'button',
                'aria-label': i18n.t('Copy content'),
                'title': i18n.t('Copy content'),
                'contenteditable': 'false',
            },
        },
        iconVnode,
    );
}

class Code extends Parent {
    public override parent: Nullable<CodeBlock> = null;
    // Code is reused by frontmatter, math and diagrams; only actual code blocks get line numbers.
    private readonly _withLineNumbers: boolean;
    // Cached reference to the gutter wrapper so CodeBlockContent.update() does
    // not pay a querySelector on every keystroke.
    public lineNumbersWrapper: HTMLElement | null = null;
    public copyButton: HTMLButtonElement | null = null;

    static override blockName = 'code';

    static create(muya: Muya, state: CodeContentState) {
        const code = new Code(muya, state.name === 'code-block');

        code.append(ScrollPage.loadBlock('codeblock.content').create(muya, state));
        const copyButton = code.copyButton;
        if (copyButton)
            copyButton.hidden = state.name !== 'code-block' || !state.text;

        return code;
    }

    override get path() {
        const { path: pPath } = this.parent!;

        return [...pPath];
    }

    constructor(muya: Muya, withLineNumbers: boolean = false) {
        super(muya);
        this.tagName = 'code';
        this.classList = ['mu-code'];
        this.attributes = { spellcheck: 'false' };
        this._withLineNumbers = withLineNumbers;
        this.createDomNode();
        this._createCopyNode();
        this._listen();
    }

    override getState(): TState {
        debug.warn('You can never call `getState` in code');
        return {} as TState;
    }

    private _createCopyNode() {
        const { i18n, options } = this.muya;
        const withLineNumbers = options.codeBlockLineNumbers && this._withLineNumbers;
        let html = toHTML(renderCopyButton(i18n));
        if (withLineNumbers)
            html += lineNumbersWrapperHTML();
        this.domNode!.innerHTML = html;
        this.copyButton = this.domNode!.querySelector<HTMLButtonElement>('.mu-code-copy');
        this.lineNumbersWrapper = withLineNumbers
            ? this.domNode!.querySelector<HTMLElement>(`.${LINE_NUMBERS_ROWS_CLASS}`)
            : null;
    }

    private _listen() {
        const { editor } = this.muya;

        if (this.domNode == null)
            return;

        const clickHandler = (event: Event) => {
            event.preventDefault();
            event.stopPropagation();

            const codeContent = this.firstContentInDescendant();

            if (codeContent == null) {
                debug.error('Has no code content');
                return;
            }

            if (!codeContent.text)
                return;
            const button = this.copyButton;
            if (!button)
                return;
            const writer = this.muya.options.clipboardWriteText;
            if (!writer) {
                editor.clipboard.copy(CopyType.COPY_CODE_CONTENT, codeContent.text);
                return;
            }
            void writer(codeContent.text).catch(() => false).then((ok) => {
                showCopyFeedback(button, ok, this.muya.i18n.t('Copy content'), this.muya.i18n);
            });
        };

        const mousedownHandler = (event: Event) => {
            event.preventDefault();
        };

        const clickObservable = fromEvent(this.copyButton!, 'click');
        clickObservable.subscribe(clickHandler);

        const mousedownObservable = fromEvent(this.copyButton!, 'mousedown');
        mousedownObservable.subscribe(mousedownHandler);
    }
}

export default Code;
