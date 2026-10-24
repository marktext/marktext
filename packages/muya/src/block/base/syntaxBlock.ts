import type { Muya } from '../../muya';
import type { TSyntaxState } from '../../state/syntax';
import { syntaxOperations } from '../../state/syntaxOperations';
import { deepClone } from '../../utils';
import Parent from './parent';

/** Owns the current source form alongside the Block's editable content. */
export default class SyntaxBlock<S extends TSyntaxState> extends Parent {
    public syntax: S['syntax'];

    constructor(muya: Muya, state: S) {
        super(muya);
        this.syntax = deepClone(state.syntax);
    }

    setSyntax(syntax: S['syntax']) {
        this.syntax = deepClone(syntax);
        this.reflectSyntax();
    }

    updateSyntax(syntax: S['syntax']) {
        if (!this.muya.canMutate)
            return;
        this.transactions.enqueue(syntaxOperations(this.path, this.syntax, syntax));
        this.setSyntax(syntax);
    }

    protected reflectSyntax() {}

    protected withSyntax(state: Omit<S, 'syntax'>): S {
        return { ...state, syntax: deepClone(this.syntax) } as S;
    }
}
