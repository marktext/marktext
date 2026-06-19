import type { Muya } from '../../../muya';
import type { ICodeBlockState } from '../../../state/types';
import type { TBlockPath } from '../../types';
import diff from 'fast-diff';
import { diffToTextOp } from '../../../utils';
import { operateClassName } from '../../../utils/dom';
import logger from '../../../utils/logger';
import { loadLanguage } from '../../../utils/prism';
import Parent from '../../base/parent';
import { ScrollPage } from '../../scrollPage';

const debug = logger('codeblock:');

class CodeBlock extends Parent {
    public meta: ICodeBlockState['meta'];
    static override blockName = 'code-block';

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

        !!value
        && loadLanguage(value)
            .then((infoList) => {
                if (!Array.isArray(infoList))
                    return;
                // There are three status `loaded`, `noexist` and `cached`.
                // if the status is `loaded`, indicated that it's a new loaded language
                const needRender = infoList.some(
                    ({ status }) => status === 'loaded' || status === 'cached',
                );
                if (needRender)
                    this.lastContentInDescendant()?.update();
            })
            .catch((err) => {
                // if no parameter provided, will cause error.
                debug.warn(err);
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
