import type { Muya } from '../../../muya';
import type { IFrontmatterPropertyState, IFrontmatterState } from '../../../state/types';
import type { TBlockPath } from '../../types';
import type FrontmatterRow from './row';
import { mixins } from '../../../utils';
import { LinkedList } from '../../base/linkedList/linkedList';
import Parent from '../../base/parent';
import IContainerQueryBlock from '../../mixins/containerQueryBlock';
import { ScrollPage } from '../../scrollPage';

@mixins(IContainerQueryBlock)
class FrontmatterBody extends Parent {
    override children: LinkedList<FrontmatterRow> = new LinkedList();

    static override blockName = 'frontmatter.body';

    static create(muya: Muya, state: IFrontmatterState) {
        const body = new FrontmatterBody(muya);

        body.append(
            ...state.properties.map(prop =>
                ScrollPage.loadBlock('frontmatter.row').create(muya, prop),
            ),
        );

        return body;
    }

    override get path(): TBlockPath {
        return [...this.parent!.path, 'properties'];
    }

    constructor(muya: Muya) {
        super(muya);
        this.tagName = 'div';
        this.classList = ['mu-frontmatter-body'];
        this.createDomNode();
        this._setupDragDrop();
    }

    private _rowFromEl(el: Element | null): FrontmatterRow | null {
        if (!el) {
            return null;
        }
        let found: FrontmatterRow | null = null;
        this.forEach((row) => {
            const r = row as FrontmatterRow;
            if (found === null && r.domNode?.contains(el)) {
                found = r;
            }
        });
        return found;
    }

    private _setupDragDrop(): void {
        const dom = this.domNode!;
        let draggedRow: FrontmatterRow | null = null;
        let dropRow: FrontmatterRow | null = null;
        let dropBefore = true;

        const clearIndicator = () => {
            dropRow?.domNode?.classList.remove('mu-drop-above', 'mu-drop-below');
            dropRow = null;
        };

        dom.addEventListener('dragstart', (e: DragEvent) => {
            const target = e.target as Element;
            if (!target?.classList?.contains('mu-frontmatter-drag-handle')) {
                return;
            }
            const row = this._rowFromEl(target);
            if (!row) {
                return;
            }
            draggedRow = row;
            if (e.dataTransfer) {
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', '');
            }
        });

        dom.addEventListener('dragend', () => {
            clearIndicator();
            draggedRow = null;
        });

        dom.addEventListener('dragover', (e: DragEvent) => {
            if (!draggedRow) {
                return;
            }
            e.preventDefault();
            if (e.dataTransfer) {
                e.dataTransfer.dropEffect = 'move';
            }

            const target = this._rowFromEl(e.target as Element);
            if (!target || target === draggedRow) {
                return;
            }

            const cellRect = (e.target as Element).getBoundingClientRect();
            const newBefore = e.clientY < cellRect.top + cellRect.height / 2;

            if (dropRow !== target || dropBefore !== newBefore) {
                clearIndicator();
                dropRow = target;
                dropBefore = newBefore;
                target.domNode?.classList.add(newBefore ? 'mu-drop-above' : 'mu-drop-below');
            }
        });

        dom.addEventListener('dragleave', (e: DragEvent) => {
            if (dom.contains(e.relatedTarget as Node)) {
                return;
            }
            clearIndicator();
        });

        dom.addEventListener('drop', (e: DragEvent) => {
            e.preventDefault();
            if (!draggedRow || !dropRow || draggedRow === dropRow) {
                return;
            }

            const insertRef = dropBefore
                ? dropRow
                : (dropRow.next as FrontmatterRow | null);

            clearIndicator();

            if (insertRef !== draggedRow) {
                draggedRow.remove('user');
                this.insertBefore(draggedRow, insertRef, 'user');
            }

            draggedRow = null;
        });
    }

    override getState(): IFrontmatterState {
        // Should not be called directly — Frontmatter.getState() reads from this.
        return {
            name: 'frontmatter',
            meta: { lang: 'yaml', style: '-' },
            properties: this.map(row => (row as FrontmatterRow).getState()) as IFrontmatterPropertyState[],
        };
    }
}

export default FrontmatterBody;
