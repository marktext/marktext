import type { Muya } from '../../../muya';
import type { ICodeBlockState } from '../../../state/types';
import type { TBlockPath } from '../../types';
import { defaultCodeSyntax } from '../../../state/syntax';
import { firstWordOfInfo } from '../../../utils';
import logger from '../../../utils/logger';
import { loadedLanguages, loadLanguage, transformAliasToOrigin } from '../../../utils/prism';
import SyntaxBlock from '../../base/syntaxBlock';
import { ScrollPage } from '../../scrollPage';

const debug = logger('codeblock:');

// Must match CodeBlockContent.update() so grammar-change detection agrees with rendering.
function renderedGrammarFor(infoString: string): string {
    const language = firstWordOfInfo(infoString);
    if (!language)
        return '';
    const resolved = transformAliasToOrigin([language])[0];

    return resolved && loadedLanguages.has(resolved) ? resolved : '';
}

class CodeBlock extends SyntaxBlock<ICodeBlockState> {
    public meta: ICodeBlockState['meta'];
    static override blockName = 'code-block';

    // The grammar the content was last rendered with, so a language change that
    // does not change the rendering skips the rebuild. Undefined until the
    // first render, which therefore always happens.
    private _renderedGrammar: string | undefined;

    static create(muya: Muya, state: ICodeBlockState) {
        state = { ...state, syntax: state.syntax ?? defaultCodeSyntax(state.text) };
        const codeBlock = new CodeBlock(muya, state);
        const { lang } = state.meta;

        const langInput = ScrollPage.loadBlock('language-input').create(
            muya,
            state,
        );
        const code = ScrollPage.loadBlock('code').create(muya, state);

        codeBlock.append(langInput);
        codeBlock.append(code);
        const copyButton = (code as { copyButton?: HTMLButtonElement | null }).copyButton;
        if (copyButton)
            codeBlock.domNode!.appendChild(copyButton);

        // Keep the gutter outside the code element’s clipping overflow.
        const lnWrapper = (code as { lineNumbersWrapper?: HTMLElement | null }).lineNumbersWrapper;
        if (lnWrapper) {
            codeBlock.domNode!.appendChild(lnWrapper);
            // Seed gutters after attachment: unknown or absent languages never trigger a language-load render.
            requestAnimationFrame(() => {
                codeBlock.lastContentInDescendant()?.update();
            });
        }

        if (lang) {
            requestAnimationFrame(() => {
                codeBlock._renderLanguage();
            });
        }

        return codeBlock;
    }

    get lang() {
        return this.meta.lang;
    }

    set lang(value) {
        if (!this.muya.canMutate)
            return;
        this.firstContentInDescendant()!.text = value;
        this.meta.lang = value;
        if (this.syntax.form === 'indented')
            this.updateSyntax(defaultCodeSyntax(this.lastContentInDescendant()!.text));

        this._renderLanguage();
    }

    private _renderLanguage() {
        // Rerender only when the displayed grammar changes, including to plain text (#5515).
        // Load status cannot detect this; every unknown language prefix should not rebuild the DOM.
        const rerenderIfGrammarChanged = () => {
            const grammar = renderedGrammarFor(this.meta.lang ?? '');
            if (grammar === this._renderedGrammar)
                return;

            this._renderedGrammar = grammar;
            this.lastContentInDescendant()?.update();
        };

        // The full info string may include attributes; Prism uses only its first word.
        const language = firstWordOfInfo(this.meta.lang ?? '');
        if (!language) {
            rerenderIfGrammarChanged();

            return;
        }

        loadLanguage(language)
            .then(rerenderIfGrammarChanged)
            .catch((err) => {
                debug.warn(err);
                rerenderIfGrammarChanged();
            });
    }

    override get path(): TBlockPath {
        const { path: pPath } = this.parent!;
        const offset = this.parent!.offset(this);

        return [...pPath, offset];
    }

    constructor(muya: Muya, state: ICodeBlockState) {
        super(muya, state);
        const { meta, syntax } = state;
        this.tagName = 'pre';
        this.meta = meta;
        this.classList = ['mu-code-block', `mu-${syntax.form}-code`];
        if (syntax.form === 'fenced' && syntax.fenceChar === '~')
            this.classList.push('mu-tilde-fence');
        if (muya.options.codeBlockLineNumbers)
            this.classList.push('mu-line-numbers');
        this.createDomNode();
    }

    protected override reflectSyntax() {
        this.domNode?.classList.toggle('mu-fenced-code', this.syntax.form === 'fenced');
        this.domNode?.classList.toggle('mu-indented-code', this.syntax.form === 'indented');
        this.domNode?.classList.toggle('mu-tilde-fence', this.syntax.form === 'fenced' && this.syntax.fenceChar === '~');
    }

    queryBlock(path: TBlockPath) {
        if (path.length === 0) {
            return this;
        }
        else {
            if (path[0] === 'meta' || path[0] === 'syntax')
                return this;
            else if (path[0] === 'lang')
                return this.firstContentInDescendant();
            else
                return this.lastContentInDescendant();
        }
    }

    override getState(): ICodeBlockState {
        return this.withSyntax({
            name: 'code-block',
            meta: { ...this.meta },
            text: this.lastContentInDescendant()!.text,
        });
    }
}

export default CodeBlock;
