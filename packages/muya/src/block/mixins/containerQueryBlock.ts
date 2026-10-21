/* eslint-disable ts/no-unsafe-declaration-merging */
import type Content from '../base/content';
import type Parent from '../base/parent';
import type { TBlockPath } from '../types';

interface IContainerQueryBlock {
    find: (p: number) => Parent | Content;
}
class IContainerQueryBlock {
    queryBlock(path: TBlockPath) {
        if (typeof path[0] === 'string' && /children|meta|align|type|lang/.test(path[0]))
            path.shift();

        if (path.length === 0)
            return this;

        const p = path.shift() as number;
        // Remaining path segments imply a Parent with queryBlock; terminal results may be Content leaves.
        const block = this.find(p) as (Parent & { queryBlock: (p: TBlockPath) => Parent | Content | undefined }) | Content;

        return block && path.length && 'queryBlock' in block
            ? block.queryBlock(path)
            : block;
    }
}

export default IContainerQueryBlock;
