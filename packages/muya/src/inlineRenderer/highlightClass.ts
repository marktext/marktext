import type { H, IHighlight } from './types';
import { CLASS_NAMES } from '../config';

// `active` is optional because `union()` clips a highlight down to a token and
// the clipped value is what the renderers paint.
type IHighlightPaint = Pick<IHighlight, 'className' | 'dataId'> & { active?: boolean };

// Search marks are `mu-highlight` / `mu-selection` from `active`. Comment marks
// carry `className` (`mu-comment`) and add `mu-comment-active` when selected.
// A merged overlap puts the search class into `className` as well, so `active`
// on that span means "comment is selected", not "search match is current".
export function resolveHighlightClass(light: IHighlightPaint): string {
    if (light.className) {
        const parts = light.className.split(/\s+/).filter(Boolean);

        if (
            light.active
            && parts.includes(CLASS_NAMES.MU_COMMENT)
            && !parts.includes(CLASS_NAMES.MU_COMMENT_ACTIVE)
        ) {
            parts.push(CLASS_NAMES.MU_COMMENT_ACTIVE);
        }

        return parts.join(' ');
    }

    return light.active ? CLASS_NAMES.MU_HIGHLIGHT : CLASS_NAMES.MU_SELECTION;
}

export function highlightClassSelector(light: IHighlightPaint): string {
    return resolveHighlightClass(light).replace(/\s+/g, '.');
}

export function highlightVNode(h: H, light: IHighlightPaint, text: string) {
    const selector = `span.${highlightClassSelector(light)}`;

    if (!light.dataId)
        return h(selector, text);

    return h(selector, {
        attrs: { 'data-comment-id': light.dataId },
    }, text);
}
