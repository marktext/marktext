import type { Muya } from '../../../muya';
import type { IFrontmatterMeta, IFrontmatterState } from '../../../state/types';
// import { operateClassName } from '../../../utils/dom'
import type { TBlockPath } from '../../types';
import logger from '../../../utils/logger';
// import { diffToTextOp } from '../../../utils'
import { loadLanguage } from '../../../utils/prism';
// import diff from 'fast-diff'
import Parent from '../../base/parent';
import { ScrollPage } from '../../scrollPage';

const debug = logger('frontmatter:');
const COLLAPSED_CLASS = 'mu-frontmatter-collapsed';
const TOGGLE_CLASS = 'mu-frontmatter-toggle';

// The before/after focus markers mirror the delimiters `stateToMarkdown`
// serializes for each front-matter type, so they reflect the real fences:
// yaml `---`, toml `+++`, json `;;;`, or the json-braces variant (`{` / `}`).
function delimiters(meta: IFrontmatterMeta): [string, string] {
    switch (meta.lang) {
        case 'toml':
            return ['+++', '+++'];
        case 'json':
            return meta.style === ';' ? [';;;', ';;;'] : ['{', '}'];
        default:
            return ['---', '---'];
    }
}

class Frontmatter extends Parent {
    public meta: IFrontmatterMeta;
    private _collapsed: boolean;
    private _toggleNode: HTMLButtonElement | null = null;

    static override blockName = 'frontmatter';

    static create(muya: Muya, state: IFrontmatterState) {
        const frontmatter = new Frontmatter(muya, state);
        const { lang } = state.meta;
        const code = ScrollPage.loadBlock('code').create(muya, state);

        frontmatter.append(code);

        if (lang)
            frontmatter.lang = lang;

        return frontmatter;
    }

    get lang() {
        return this.meta.lang;
    }

    set lang(value) {
        this.meta.lang = value;

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

    override get path() {
        const { path: pPath } = this.parent!;
        const offset = this.parent!.offset(this);

        return [...pPath, offset];
    }

    constructor(muya: Muya, { meta }: IFrontmatterState) {
        super(muya);
        this.tagName = 'pre';
        this.meta = meta;
        this._collapsed = muya.options.frontmatterDefaultCollapsed;
        this.classList = ['mu-frontmatter'];
        const [start, end] = delimiters(meta);
        this.attributes.frontMatterStart = start;
        this.attributes.frontMatterEnd = end;
        this.createDomNode();
        this._createToggle();
        this._setCollapsed(this._collapsed);
    }

    private _createToggle() {
        const toggle = document.createElement('button');
        const label = this.muya.i18n.t('Properties');

        toggle.type = 'button';
        toggle.className = TOGGLE_CLASS;
        toggle.textContent = label;
        toggle.title = label;
        toggle.setAttribute('contenteditable', 'false');

        toggle.addEventListener('mousedown', event => event.stopPropagation());
        toggle.addEventListener('click', (event) => {
            event.stopPropagation();
            this._setCollapsed(!this._collapsed);
        });

        this.domNode!.appendChild(toggle);
        this._toggleNode = toggle;
    }

    private _setCollapsed(collapsed: boolean) {
        this._collapsed = collapsed;
        this.domNode!.classList.toggle(COLLAPSED_CLASS, collapsed);
        this._toggleNode?.setAttribute('aria-expanded', String(!collapsed));
    }

    queryBlock(path: TBlockPath) {
        if (path.length === 0) {
            return this;
        }
        else {
            if (path[0] === 'meta' || path[0] === 'type') {
                return this;
            }
            else if (path[0] === 'lang') {
                // TODO is there right?
                return this.firstContentInDescendant();
            }
            else {
                return this.lastContentInDescendant();
            }
        }
    }

    override getState(): IFrontmatterState {
        const state: IFrontmatterState = {
            name: 'frontmatter',
            meta: { ...this.meta },
            text: this.lastContentInDescendant()?.text ?? '',
        };

        return state;
    }
}

export default Frontmatter;
