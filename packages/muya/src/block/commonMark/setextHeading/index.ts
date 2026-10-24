import type { Muya } from '../../../muya';
import type { ISetextHeadingState } from '../../../state/types';
import type SetextHeadingContent from '../../content/setextHeadingContent';
import { defaultSetextSyntax } from '../../../state/syntax';
import { mixins } from '../../../utils';
import SyntaxBlock from '../../base/syntaxBlock';
import LeafQueryBlock from '../../mixins/leafQueryBlock';
import { ScrollPage } from '../../scrollPage';

@mixins(LeafQueryBlock)
class SetextHeading extends SyntaxBlock<ISetextHeadingState> {
    public meta: ISetextHeadingState['meta'];

    static override blockName = 'setext-heading';

    static create(muya: Muya, state: ISetextHeadingState) {
        state = { ...state, syntax: state.syntax ?? defaultSetextSyntax(state.text) };
        const heading = new SetextHeading(muya, state);

        heading.appendAttachment(
            ScrollPage.loadBlock('heading-copy-link').create(muya, null),
        );

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

    constructor(muya: Muya, state: ISetextHeadingState) {
        super(muya, state);
        const { meta } = state;
        this.tagName = `h${meta.level}`;
        this.meta = meta;
        this.classList = ['mu-setext-heading'];
        this.createDomNode();
    }

    override getState(): ISetextHeadingState {
        return this.withSyntax({
            name: 'setext-heading',
            meta: this.meta,
            text: (this.children.head as SetextHeadingContent).text,
        });
    }
}

export default SetextHeading;
