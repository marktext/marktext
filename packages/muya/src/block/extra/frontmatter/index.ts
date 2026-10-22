import type { Muya } from '../../../muya';
import type { IFrontmatterMeta, IFrontmatterState } from '../../../state/types';
import type { TBlockPath } from '../../types';
import logger from '../../../utils/logger';
import { loadLanguage } from '../../../utils/prism';
import Parent from '../../base/parent';
import { ScrollPage } from '../../scrollPage';

const debug = logger('frontmatter:');

// Focus delimiters must match the frontmatter fences emitted by stateToMarkdown.
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

    static override blockName = 'frontmatter';

    static create(muya: Muya, state: IFrontmatterState) {
        const frontmatter = new Frontmatter(muya, state);
        const { lang } = state.meta;
        const code = ScrollPage.loadBlock('code').create(muya, state);

        frontmatter.append(code);

        if (lang)
            frontmatter._renderLanguage();

        return frontmatter;
    }

    get lang() {
        return this.meta.lang;
    }

    set lang(value) {
        if (!this.muya.canMutate)
            return;
        this.meta.lang = value;
        this._renderLanguage();
    }

    private _renderLanguage() {
        const value = this.meta.lang;
        !!value
        && loadLanguage(value)
            .then((infoList) => {
                if (!Array.isArray(infoList))
                    return;
                const needRender = infoList.some(
                    ({ status }) => status === 'loaded' || status === 'cached',
                );
                if (needRender)
                    this.lastContentInDescendant()?.update();
            })
            .catch((err) => {
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
        this.classList = ['mu-frontmatter'];
        const [start, end] = delimiters(meta);
        this.attributes.frontMatterStart = start;
        this.attributes.frontMatterEnd = end;
        this.createDomNode();
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
