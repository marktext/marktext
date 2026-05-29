import type { Muya } from '../../../muya';
import type { ISetextHeadingState } from '../../../state/types';
import type SetextHeadingContent from '../../content/setextHeadingContent';
import { mixins } from '../../../utils';
import Parent from '../../base/parent';
import LeafQueryBlock from '../../mixins/leafQueryBlock';
import { ScrollPage } from '../../scrollPage';

@mixins(LeafQueryBlock)
class SetextHeading extends Parent {
    public meta: ISetextHeadingState['meta'];

    static override blockName = 'setext-heading';

    static create(muya: Muya, state: ISetextHeadingState) {
        const heading = new SetextHeading(muya, state);

        heading.append(
            ScrollPage.loadBlock('setextheading.content').create(muya, state.text),
        );

        return heading;
    }

    override get path() {
        const { path: pPath } = this.parent!;
        const offset = this.parent!.offset(this);

        return [...pPath, offset];
    }

    constructor(muya: Muya, { meta }: ISetextHeadingState) {
        super(muya);
        this.tagName = `h${meta.level}`;
        this.meta = meta;
        this.classList = ['mu-setext-heading'];
        this.createDomNode();
    }

    override getState(): ISetextHeadingState {
        return {
            name: 'setext-heading',
            meta: this.meta,
            text: (this.children.head as SetextHeadingContent).text,
        };
    }
}

export default SetextHeading;
