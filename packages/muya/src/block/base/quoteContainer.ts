import type { TState } from '../../state/types';
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
}
