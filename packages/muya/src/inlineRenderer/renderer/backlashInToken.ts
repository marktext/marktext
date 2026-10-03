import type { H, Token } from '../types';
import type Renderer from './index';
import { CLASS_NAMES } from '../../config';
import { isEven, union } from '../../utils';
import { highlightClassSelector } from '../highlightClass';

export default function backlashInToken(
    this: Renderer,
    h: H,
    backlashes: string,
    outerClass: string,
    start: number,
    token: Token,
) {
    const { highlights = [] } = token;
    const chunks = backlashes.split('');
    const len = chunks.length;
    const result = [];
    let i: number;

    for (i = 0; i < len; i++) {
        const chunk = chunks[i];
        const light = highlights.filter(item =>
            union({ start: start + i, end: start + i + 1 }, item),
        );
        let selector = 'span';
        if (light.length)
            selector += `.${highlightClassSelector(light[0])}`;

        const data = light[0]?.dataId
            ? { attrs: { 'data-comment-id': light[0].dataId } }
            : undefined;
        const className = isEven(i) ? outerClass : CLASS_NAMES.MU_BACKLASH;
        const sel = `${selector}.${className}`;

        result.push(data ? h(sel, data, chunk) : h(sel, chunk));
    }

    return result;
}
