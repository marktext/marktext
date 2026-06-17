import type I18n from '../../../i18n';
import type { Muya } from '../../../muya';
import type { CodeContentState, TState } from '../../../state/types';
import type { Nullable } from '../../../types';
import type CodeBlock from './index';
import { fromEvent } from 'rxjs';
import copyIcon from '../../../assets/icons/copy/2.png';
import { CopyType } from '../../../clipboard/types';
import { LINE_NUMBERS_ROWS_CLASS, lineNumbersWrapperHTML } from '../../../utils/codeBlockLineNumbers';
import logger from '../../../utils/logger';
import { h, toHTML } from '../../../utils/snabbdom';
import Parent from '../../base/parent';
import { ScrollPage } from '../../scrollPage';

const debug = logger('code:');

function renderCopyButton(i18n: I18n) {
    const selector = 'a.mu-code-copy';
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
                title: i18n.t('Copy content'),
                contenteditable: 'false',
            },
        },
        iconVnode,
    );
}

class Code extends Parent {
    public override parent: Nullable<CodeBlock> = null;
    // Line numbers only apply to real code blocks (`code-block`). Frontmatter,
    // math, diagram, and html containers all reuse `Code` but must not show
    // a gutter — so we gate creation on the state name, not just the option.
    private readonly _withLineNumbers: boolean;
    // Cached reference to the gutter wrapper so CodeBlockContent.update() does
    // not pay a querySelector on every keystroke.
    public lineNumbersWrapper: HTMLElement | null = null;

    static override blockName = 'code';

    static create(muya: Muya, state: CodeContentState) {
        const code = new Code(muya, state.name === 'code-block');

        code.append(ScrollPage.loadBlock('codeblock.content').create(muya, state));

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

    // Create the copy button at the top-right; when codeBlockLineNumbers is on
    // AND this Code is hosted inside a real code-block (not frontmatter / math /
    // diagram / html), also create an empty line-numbers wrapper and cache
    // its element so CodeBlockContent.update() can sync rows without a
    // querySelector per keystroke.
    private _createCopyNode() {
        const { i18n, options } = this.muya;
        const withLineNumbers = options.codeBlockLineNumbers && this._withLineNumbers;
        let html = toHTML(renderCopyButton(i18n));
        if (withLineNumbers)
            html += lineNumbersWrapperHTML();
        this.domNode!.innerHTML = html;
        this.lineNumbersWrapper = withLineNumbers
            ? this.domNode!.querySelector<HTMLElement>(`.${LINE_NUMBERS_ROWS_CLASS}`)
            : null;
    }

    private _listen() {
        const { editor } = this.muya;

        if (this.domNode == null)
            return;

        // Copy code content to clipboard.
        const clickHandler = (event: Event) => {
            event.preventDefault();
            event.stopPropagation();

            const codeContent = this.firstContentInDescendant();

            if (codeContent == null) {
                debug.error('Has no code content');
                return;
            }

            editor.clipboard.copy(CopyType.COPY_CODE_CONTENT, codeContent.text);
        };

        const mousedownHandler = (event: Event) => {
            event.preventDefault();
        };

        const clickObservable = fromEvent(this.domNode.firstElementChild!, 'click');
        clickObservable.subscribe(clickHandler);

        const mousedownObservable = fromEvent(this.domNode.firstElementChild!, 'mousedown');
        mousedownObservable.subscribe(mousedownHandler);
    }
}

export default Code;
