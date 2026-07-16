import type { TState } from './types';

/**
 * Clone Muya's bounded document-state schema without the high fixed cost of
 * structuredClone on Android WebView. State metadata is one level of scalar
 * fields; nested document data exists only in `children` arrays.
 */
export function cloneStateTree(states: readonly TState[]): TState[] {
    return states.map((state) => {
        if ('children' in state) {
            const children = cloneStateTree(state.children);
            if ('meta' in state && state.meta) {
                return {
                    ...state,
                    meta: { ...state.meta },
                    children,
                } as TState;
            }
            return { ...state, children } as TState;
        }

        if ('meta' in state) {
            return { ...state, meta: { ...state.meta } } as TState;
        }

        return { ...state };
    });
}
