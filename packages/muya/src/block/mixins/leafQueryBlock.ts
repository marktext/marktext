import type { TBlockPath } from '../types';

class LeafQueryBlock {
    public firstChild: unknown;

    queryBlock(path: TBlockPath) {
        return path.length && path[0] === 'text' ? this.firstChild : this;
    }
}

export default LeafQueryBlock;
