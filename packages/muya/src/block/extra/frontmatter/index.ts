import type { Muya } from '../../../muya';
import type { IFrontmatterMeta, IFrontmatterPropertyState, IFrontmatterState } from '../../../state/types';
import type { Nullable } from '../../../types';
import type Content from '../../base/content';
import type { TBlockPath } from '../../types';
import type FrontmatterBody from './body';
import type FrontmatterRow from './row';
import { operateClassName } from '../../../utils/dom';
import Parent from '../../base/parent';
import { ScrollPage } from '../../scrollPage';

class Frontmatter extends Parent {
    public meta: IFrontmatterMeta;

    private _collapsed: boolean = false;

    static override blockName = 'frontmatter';

    static create(muya: Muya, state: IFrontmatterState) {
        const frontmatter = new Frontmatter(muya, state);
        const body = ScrollPage.loadBlock('frontmatter.body').create(muya, state);

        // appendAttachment sets body.parent and appends body's DOM after the header.
        frontmatter.appendAttachment(body);
        // After appending the body, add the footer button to the frontmatter domNode.
        const footer = document.createElement('div');
        footer.className = 'mu-frontmatter-footer';
        footer.setAttribute('contenteditable', 'false');
        footer.innerHTML = '<span class="mu-frontmatter-add-icon">+</span> Add property';
        footer.addEventListener('click', () => frontmatter.addProperty());
        frontmatter.domNode!.appendChild(footer);

        return frontmatter;
    }

    override get path() {
        const { path: pPath } = this.parent!;
        const offset = this.parent!.offset(this);
        return [...pPath, offset];
    }

    constructor(muya: Muya, { meta }: IFrontmatterState) {
        super(muya);
        this.tagName = 'div';
        this.meta = meta;
        this.classList = ['mu-frontmatter'];
        this.createDomNode();

        // Prepend the "Properties" header.
        const header = document.createElement('div');
        header.className = 'mu-frontmatter-header';
        header.setAttribute('contenteditable', 'false');
        header.innerHTML = '<span class="mu-frontmatter-toggle">›</span><span class="mu-frontmatter-title">Properties</span>';
        header.addEventListener('click', () => this._toggleCollapse());
        this.domNode!.appendChild(header);
    }

    private _toggleCollapse() {
        this._collapsed = !this._collapsed;
        operateClassName(this.domNode!, this._collapsed ? 'add' : 'remove', 'mu-collapsed');
    }

    get body(): Nullable<FrontmatterBody> {
        return this.attachments.head as Nullable<FrontmatterBody>;
    }

    queryBlock(path: TBlockPath) {
        if (path.length === 0)
            return this;

        const first = path[0];
        if (first === 'properties') {
            path.shift();
            if (path.length === 0)
                return this.body;
            const body = this.body as (Parent & { queryBlock: (p: TBlockPath) => Parent | Content | undefined }) | null;
            return body?.queryBlock(path);
        }

        return this;
    }

    addProperty() {
        const emptyProp: IFrontmatterPropertyState = {
            name: 'frontmatter.row',
            key: '',
            value: '',
        };
        const body = this.body;
        if (!body)
            return;

        const newRow = ScrollPage.loadBlock('frontmatter.row').create(this.muya, emptyProp) as FrontmatterRow;
        body.append(newRow, 'user');
        newRow.firstContentInDescendant()?.setCursor(0, 0, true);
    }

    override getState(): IFrontmatterState {
        const body = this.body;
        return {
            name: 'frontmatter',
            meta: { ...this.meta },
            properties: body
                ? (body.map(row => (row as FrontmatterRow).getState()) as IFrontmatterPropertyState[])
                : [],
        };
    }
}

export default Frontmatter;
