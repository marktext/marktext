import type { Muya } from '../../../muya';
import type { ICodeBlockState } from '../../../state/types';
import type { TBlockPath } from '../../types';
import diff from 'fast-diff';
import { diffToTextOp, firstWordOfInfo } from '../../../utils';
import { operateClassName } from '../../../utils/dom';
import logger from '../../../utils/logger';
import { loadedLanguages, loadLanguage, transformAliasToOrigin } from '../../../utils/prism';
import Parent from '../../base/parent';
import { ScrollPage } from '../../scrollPage';

const debug = logger('codeblock:');

/**
 * The grammar a block with this info string will actually be highlighted with,
 * or `''` when it will render as plain text.
 *
 * Mirrors the lookup in `CodeBlockContent.update()` — the two have to agree, or
 * the setter's "did the rendering change" check reads a different answer than
 * the renderer acts on.
 */
function renderedGrammarFor(infoString: string): string {
    const language = firstWordOfInfo(infoString);
    if (!language)
        return '';
    const resolved = transformAliasToOrigin([language])[0];

    return resolved && loadedLanguages.has(resolved) ? resolved : '';
}

class CodeBlock extends Parent {
    public meta: ICodeBlockState['meta'];
    static override blockName = 'code-block';

    // The grammar the content was last rendered with, so a language change that
    // does not change the rendering skips the rebuild. Undefined until the
    // first render, which therefore always happens.
    private _renderedGrammar: string | undefined;

    static create(muya: Muya, state: ICodeBlockState) {
        const codeBlock = new CodeBlock(muya, state);
        const { lang } = state.meta;

        const langInput = ScrollPage.loadBlock('language-input').create(
            muya,
            state,
        );
        const code = ScrollPage.loadBlock('code').create(muya, state);

        codeBlock.append(langInput);
        codeBlock.append(code);

        // Move the line-numbers gutter from .mu-code into the pre so that
        // .mu-code's overflow (hidden/auto) does not clip the left-side gutter.
        // The pre already has position:relative and padding-left:2.5em for this.
        const lnWrapper = (code as { lineNumbersWrapper?: HTMLElement | null }).lineNumbersWrapper;
        if (lnWrapper) {
            codeBlock.domNode!.appendChild(lnWrapper);
            // The gutter fills from CodeBlockContent.update(), a no-op until the
            // tree is wired. The language-load callback below re-runs it, but
            // language-less / unknown-language / indented blocks never load one —
            // seed them here so first render fills the gutter regardless of language.
            requestAnimationFrame(() => {
                codeBlock.lastContentInDescendant()?.update();
            });
        }

        if (lang) {
            requestAnimationFrame(() => {
                codeBlock.lang = lang;
            });
        }

        return codeBlock;
    }

    get lang() {
        return this.meta.lang;
    }

    set lang(value) {
        this.meta.lang = value;

        if (this.meta.type !== 'fenced') {
            this.meta.type = 'fenced';
            // dispatch change to modify json state
            const diffs = diff('indented', 'fenced');
            const { path } = this;
            path.push('meta', 'type');

            this.jsonState.editOperation(path, diffToTextOp(diffs));

            operateClassName(this.domNode!, 'remove', 'mu-indented-code');
            operateClassName(this.domNode!, 'add', 'mu-fenced-code');
        }

        // Render when the grammar the block is drawn with changes — including
        // to none, which is what clearing the language or naming one Prism does
        // not have amounts to. Those two used to render nothing at all and left
        // the previous grammar's markup on screen (#5515).
        //
        // The load `status` cannot stand in for this. It reports whether the
        // grammar reached `loadedLanguages`, i.e. whether the block *will*
        // highlight — not whether that differs from what it already shows. The
        // language input calls this setter on every keystroke, so typing a name
        // Prism does not have walks a run of unknown prefixes that must render
        // once, not once each.
        const rerenderIfGrammarChanged = () => {
            const grammar = renderedGrammarFor(this.meta.lang ?? '');
            if (grammar === this._renderedGrammar)
                return;

            this._renderedGrammar = grammar;
            this.lastContentInDescendant()?.update();
        };

        // `value` is the full info string; load Prism for its first word only.
        const language = firstWordOfInfo(value);
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

    constructor(muya: Muya, { meta }: ICodeBlockState) {
        super(muya);
        this.tagName = 'pre';
        this.meta = meta;
        this.classList = ['mu-code-block', `mu-${meta.type}-code`];
        if (muya.options.codeBlockLineNumbers)
            this.classList.push('mu-line-numbers');
        this.createDomNode();
    }

    queryBlock(path: TBlockPath) {
        if (path.length === 0) {
            return this;
        }
        else {
            if (path[0] === 'meta' || path[0] === 'type')
                return this;
            else if (path[0] === 'lang')
                return this.firstContentInDescendant();
            else
                return this.lastContentInDescendant();
        }
    }

    override getState(): ICodeBlockState {
        const state: ICodeBlockState = {
            name: 'code-block',
            meta: { ...this.meta },
            text: this.lastContentInDescendant()!.text,
        };

        return state;
    }
}

export default CodeBlock;
