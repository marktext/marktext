import type { JSONOp, JSONOpComponent, Path } from 'ot-json1';
import type { TSyntaxState } from '../../state/syntax';
import type { ICodeBlockState, TState } from '../../state/types';
import { type as json1 } from 'ot-json1';
import { stateAtPath } from '../../state/paths';
import { defaultCodeSyntax, headingBody, reconcilePrefixes } from '../../state/syntax';
import { syntaxOperations } from '../../state/syntaxOperations';
import { deepClone } from '../../utils';

function isSyntaxState(value: unknown): value is TSyntaxState {
    return !!value && typeof value === 'object' && 'name' in value
        && ['atx-heading', 'setext-heading', 'code-block'].includes(String(value.name));
}

function affectedBlocks(root: readonly TState[], operation: JSONOp): Path[] {
    const paths = new Map<string, Path>();
    const add = (value: unknown, path: Path, subtree = false) => {
        if (isSyntaxState(value))
            paths.set(JSON.stringify(path), path);
        if (!subtree || !value || typeof value !== 'object')
            return;
        if (Array.isArray(value))
            value.forEach((child, index) => add(child, [...path, index], true));
        else if ('children' in value)
            add(value.children, [...path, 'children'], true);
    };
    const cursor = json1.readCursor(operation);
    cursor.traverse(null, (component: JSONOpComponent) => {
        const path = cursor.getPath();
        for (let depth = 0; depth <= path.length; depth++) {
            const prefix = path.slice(0, depth);
            const value = stateAtPath(root, prefix);
            add(value, prefix, depth === path.length && (component.i !== undefined || component.d !== undefined));
            const index = path[depth];
            if (Array.isArray(value) && typeof index === 'number' && depth === path.length - 1) {
                for (const offset of [-1, 0, 1])
                    add(value[index + offset], [...prefix, index + offset]);
            }
        }
    });
    return [...paths.values()];
}

function repairedSyntax(state: TSyntaxState, previous: unknown, siblings: readonly TState[], index: number): TSyntaxState['syntax'] {
    if (state.name === 'atx-heading') {
        const syntax = deepClone(state.syntax);
        const body = headingBody(state.text);
        if (body && !syntax.afterOpening)
            syntax.afterOpening = ' ';
        if (body && syntax.closing && !syntax.closing.before)
            syntax.closing.before = ' ';
        if (!syntax.closing && /(?:^|[ \t])#+[ \t]*$/.test(body)) {
            return {
                indent: syntax.indent,
                afterOpening: syntax.afterOpening,
                closing: { before: ' ', length: 1, after: syntax.trailing },
            };
        }
        return syntax;
    }
    const previousText = isSyntaxState(previous) && previous.name === state.name ? previous.text : state.text;
    if (state.name === 'setext-heading') {
        return {
            ...state.syntax,
            prefixes: state.syntax.prefixes.length === state.text.split('\n').length
                ? state.syntax.prefixes
                : reconcilePrefixes(previousText, state.text, state.syntax.prefixes, () => ''),
        };
    }
    return repairedCodeSyntax(state, previousText, siblings, index);
}

function repairedCodeSyntax(state: ICodeBlockState, previousText: string, siblings: readonly TState[], index: number) {
    let syntax = deepClone(state.syntax);
    const preceding = siblings[index - 1];
    if (syntax.form === 'indented' && ((/^[ \t\n]*$/.test(state.text) && /[^ \t\n]/.test(previousText))
        || (preceding?.name === 'code-block' && preceding.syntax.form === 'indented'))) {
        syntax = defaultCodeSyntax(state.text);
    }
    const indent = syntax.form === 'indented' ? '    ' : syntax.opening.indent;
    if (syntax.prefixes.length !== state.text.split('\n').length && !(state.text === '' && syntax.prefixes.length === 0)) {
        syntax.prefixes = reconcilePrefixes(previousText, state.text, syntax.prefixes, () => ({ raw: indent, remainder: 0 }));
    }
    const lines = state.text.split('\n');
    syntax.prefixes = syntax.prefixes.map((prefix, line) => {
        return lines[line]?.startsWith(' '.repeat(prefix.remainder))
            ? prefix
            : { raw: indent, remainder: 0 };
    });
    if (syntax.form === 'indented')
        return syntax;
    if (syntax.fenceChar === '`' && state.meta.lang.includes('`'))
        syntax.fenceChar = '~';
    let length = syntax.opening.length;
    lines.forEach((line, offset) => {
        const prefix = syntax.prefixes[offset];
        const source = prefix ? prefix.raw + line.slice(prefix.remainder) : line;
        const match = /^ {0,3}(`+|~+)[ \t]*$/.exec(source);
        if (match?.[1][0] === syntax.fenceChar)
            length = Math.max(length, match[1].length + 1);
    });
    syntax.opening.length = length;
    if (syntax.closing)
        syntax.closing.length = Math.max(syntax.closing.length, length);
    else if (index + 1 < siblings.length)
        syntax.closing = { indent: syntax.opening.indent, length, after: '' };
    return syntax;
}

/** Complete source-form legality with the edit; history replays the recorded result. */
export function blockSyntaxOperations(previous: readonly TState[], root: readonly TState[], operation: JSONOp): JSONOp {
    let corrections: JSONOp = null;
    for (const path of affectedBlocks(root, operation)) {
        const state = stateAtPath(root, path);
        if (!isSyntaxState(state))
            continue;
        const siblings = stateAtPath(root, path.slice(0, -1)) as readonly TState[];
        const syntax = repairedSyntax(state, stateAtPath(previous, path), siblings, path.at(-1) as number);
        corrections = json1.compose(corrections, syntaxOperations(path, state.syntax, syntax));
    }
    return corrections;
}
