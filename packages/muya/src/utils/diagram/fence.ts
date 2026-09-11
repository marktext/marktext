import type { IDiagramMeta, IDiagramState } from '../../state/types';

const DIAGRAM_TYPES = ['mermaid', 'plantuml', 'vega-lite', 'flowchart', 'sequence'] as const;

/**
 * The diagram type a fence language renders as, or null for a code language.
 * @param lang the first word of the fence info string
 */
export function diagramTypeOfLang(lang: string): IDiagramMeta['type'] | null {
    return DIAGRAM_TYPES.find(type => type === lang) ?? null;
}

export function createDiagramState(type: IDiagramMeta['type'], text = ''): IDiagramState {
    return {
        name: 'diagram',
        text,
        meta: { type, lang: type === 'vega-lite' ? 'json' : 'yaml' },
    };
}
