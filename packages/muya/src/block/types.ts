import type { Muya } from '../muya';

// Heterogeneous block factories narrow their state types and return different node shapes.
// The any slots preserve registry dispatch; never[] accepts concrete constructor signatures.
export interface IConstructor<T> {
    blockName: string;
    // eslint-disable-next-line ts/no-explicit-any
    create: (muya: Muya, state: any) => any;
    new (...args: never[]): T;
}

export type TBlockPath = (string | number)[];
