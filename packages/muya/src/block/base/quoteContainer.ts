import type { TState } from '../../state/types';
import type Content from './content';
import { mixins } from '../../utils';
import IContainerQueryBlock from '../mixins/containerQueryBlock';
import { ScrollPage } from '../scrollPage';
import Parent from './parent';

@mixins(IContainerQueryBlock)
export default class QuoteContainer extends Parent {
    protected override get isContainerBlock() {
        return true;
    }

    override get path() {
        return [...this.parent!.path, this.parent!.offset(this), 'children'];
    }

    protected loadChildren(states: TState[]) {
        for (const state of states)
            this.append(ScrollPage.loadBlock(state.name).create(this.muya, state));
    }

    protected childStates(): TState[] {
        return this.children.map(child => (child as Parent).getState());
    }

    backspaceAtStart(content: Content, event: Event): boolean {
        const cursor = content.getCursor();
        const paragraph = content.parent;
        if (cursor?.start.offset !== 0 || cursor.end.offset !== 0 || paragraph?.parent !== this || !paragraph.isFirstChild())
            return false;
        event.preventDefault();
        if (paragraph.isOnlyChild()) {
            this.replaceWith(paragraph);
            paragraph.firstContentInDescendant()?.setCursor(0, 0, true);
        }
        else {
            const outside = paragraph.clone() as Parent;
            this.parent!.insertBefore(outside, this);
            paragraph.remove();
            outside.firstContentInDescendant()?.setCursor(0, 0, true);
        }
        return true;
    }

    exitEmptyParagraph(paragraph: Parent) {
        const offset = this.offset(paragraph);
        const outside = paragraph.clone() as Parent;
        const state = this.getState();
        if (!('children' in state))
            return;
        const tail = state.children.slice(offset + 1);
        if (offset === 0) {
            this.parent!.insertBefore(outside, this);
        }
        else {
            this.parent!.insertAfter(outside, this);
            if (tail.length) {
                const sibling = ScrollPage.loadBlock(state.name).create(this.muya, { ...state, children: tail });
                this.parent!.insertAfter(sibling, outside);
                this.forEachAt(offset + 1, undefined, node => node.remove());
            }
        }
        paragraph.remove();
        if (!this.length())
            this.remove();
        outside.firstContentInDescendant()?.setCursor(0, 0, true);
    }
}
