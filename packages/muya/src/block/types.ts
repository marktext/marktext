import type { Muya } from '../muya';

// Block constructor signature stored in `ScrollPage.registeredBlocks` and
// returned from `ScrollPage.loadBlock`. The registry holds heterogeneous
// block kinds; each concrete subclass ships its own `static create(muya,
// state)` where `state` narrows to the corresponding I…State interface.
// `create` returns `any` so the registry-driven dispatcher chain
// (`loadBlock(...).create(muya, state).firstContentInDescendant()…`)
// stays usable across both Parent and Content shapes without forcing
// every call site to cast. Both `any` slots below are sanctioned escape
// hatches for this dispatcher pattern. The constructor uses `never[]` in
// the args (contravariant) so it accepts any concrete subclass signature
// like `new (muya: Muya, state: IAtxHeadingState)`.
export interface IConstructor<T> {
    blockName: string;
    // eslint-disable-next-line ts/no-explicit-any
    create: (muya: Muya, state: any) => any;
    new (...args: never[]): T;
}

export type TBlockPath = (string | number)[];
