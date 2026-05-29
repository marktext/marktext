import type { Muya } from '../../../muya';
import type { IThematicBreakState } from '../../../state/types';
import type ThematicBreakContent from '../../content/thematicBreakContent';
import { mixins } from '../../../utils';
import Parent from '../../base/parent';
import LeafQueryBlock from '../../mixins/leafQueryBlock';
import { ScrollPage } from '../../scrollPage';

@mixins(LeafQueryBlock)
class ThematicBreak extends Parent {
    static override blockName = 'thematic-break';

    static create(muya: Muya, state: IThematicBreakState) {
        const heading = new ThematicBreak(muya);

        heading.append(
            ScrollPage.loadBlock('thematicbreak.content').create(muya, state.text),
        );

        return heading;
    }

    override get path() {
        const { path: pPath } = this.parent!;
        const offset = this.parent!.offset(this);

        return [...pPath, offset];
    }

    constructor(muya: Muya) {
        super(muya);
        this.tagName = 'p';
        this.classList = ['mu-thematic-break'];
        this.createDomNode();
    }

    override getState(): IThematicBreakState {
        return {
            name: 'thematic-break',
            text: (this.children.head as ThematicBreakContent).text,
        };
    }
}

export default ThematicBreak;
