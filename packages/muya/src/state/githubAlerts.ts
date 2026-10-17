import type { IBlockQuoteState, IGithubAlertState, TState } from './types';
import { beginRules } from '../inlineRenderer/rules';
import { githubAlertMarker, matchGithubAlertMarker } from '../utils/githubAlerts';
import StateToMarkdown from './stateToMarkdown';

export function githubAlertAsQuote(state: IGithubAlertState): IBlockQuoteState {
    const marker = githubAlertMarker(state.meta);
    const first = state.children[0];
    const children = !state.meta.blankLineAfterMarker && first?.name === 'paragraph'
        ? [{ ...first, text: `${marker}\n${first.text}` }, ...state.children.slice(1)]
        : [{ name: 'paragraph' as const, text: marker }, ...state.children];
    return { name: 'block-quote', children };
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
        const parsed = read(state);
        if (parsed?.name !== 'github-alert')
            return state;
        const children = newline < 0
            ? state.children.slice(1)
            : [{ ...first, text: first.text.slice(newline + 1) }, ...state.children.slice(1)];
        return { name: 'github-alert', meta: parsed.meta, children };
    });
}
