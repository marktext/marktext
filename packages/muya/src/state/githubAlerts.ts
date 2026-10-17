import type { IHistorySelection } from '../selection/types';
import type { Nullable } from '../types';
import type { IBlockQuoteState, IGithubAlertState, TState } from './types';
import { beginRules } from '../inlineRenderer/rules';
import { githubAlertMarker, matchGithubAlertMarker } from '../utils/githubAlerts';
import StateToMarkdown from './stateToMarkdown';

export function githubAlertAsQuote(state: IGithubAlertState): IBlockQuoteState {
    const marker = githubAlertMarker(state.meta);
    const first = state.children[0];
    const children = state.meta.compact !== false && first?.name === 'paragraph'
        ? [{ ...first, text: `${marker}\n${first.text}` }, ...state.children.slice(1)]
        : [{ name: 'paragraph' as const, text: marker }, ...state.children];
    return { name: 'block-quote', ...(state.meta.compact !== false && first?.name !== 'paragraph' ? { meta: { compact: true } } : {}), children };
}

/** Project only top-level quotes; unrelated state and nested blocks remain intact. */
export function projectGithubAlerts(states: TState[], enabled: boolean, parse: (markdown: string) => TState[]): TState[] {
    const references: string[] = [];
    const collect = (state: TState) => {
        if (state.name === 'paragraph' && beginRules.reference_definition.test(state.text))
            references.push(state.text);
        if ('children' in state)
            state.children.forEach(collect);
    };
    states.forEach(collect);
    const serializer = new StateToMarkdown();
    return states.map((state): TState => {
        if (state.name === 'github-alert' && !enabled)
            return githubAlertAsQuote(state);
        if (state.name !== 'block-quote' || !enabled || state.meta?.style === 'fenced')
            return state;
        const first = state.children[0];
        if (first?.name !== 'paragraph' || !matchGithubAlertMarker(first.text.split('\n', 1)[0]))
            return state;
        const read = (candidate: TState) => parse(`${serializer.generate([candidate])}\n${references.join('\n\n')}`)[0];
        const newline = first.text.indexOf('\n');
        let parsed = read(state);
        // An explicit empty body belongs to a live editor draft, unlike a marker-only import.
        if (parsed?.name !== 'github-alert' && newline >= 0 && !first.text.slice(newline + 1).trim()
            && state.children.slice(1).every(child => child.name === 'paragraph' && !child.text.trim())) {
            parsed = read({ ...state, children: [{ ...first, text: `${first.text}draft` }] });
        }
        if (parsed?.name !== 'github-alert')
            return state;
        const children = newline < 0
            ? state.children.slice(1)
            : [{ ...first, text: first.text.slice(newline + 1) }, ...state.children.slice(1)];
        return { name: 'github-alert', meta: parsed.meta, children };
    });
}

/** Marker insertion/removal changes only the first body's index or text prefix. */
export function remapGithubAlertSelection(selection: Nullable<IHistorySelection>, before: TState[], after: TState[]): IHistorySelection | null {
    if (!selection)
        return null;
    const endpoint = (point: IHistorySelection['anchor']) => {
        const path = [...point.path];
        const index = Number(path[0]);
        const previous = before[index];
        const next = after[index];
        let offset = point.offset;
        if (previous?.name === 'block-quote' && next?.name === 'github-alert') {
            const first = previous.children[0];
            const newline = first?.name === 'paragraph' ? first.text.indexOf('\n') : -1;
            if (newline < 0)
                path[2] = Math.max(0, Number(path[2]) - 1);
            else if (path[2] === 0)
                offset = Math.max(0, offset - newline - 1);
        }
        else if (previous?.name === 'github-alert' && next?.name === 'block-quote') {
            const joined = previous.meta.compact !== false && previous.children[0]?.name === 'paragraph';
            if (!joined)
                path[2] = Number(path[2]) + 1;
            else if (path[2] === 0)
                offset += githubAlertMarker(previous.meta).length + 1;
        }
        return { path, offset };
    };
    return { ...selection, anchor: endpoint(selection.anchor), focus: endpoint(selection.focus) };
}
