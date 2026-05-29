import type { H, Token } from '../types';
import type Renderer from './index';
import { CLASS_NAMES } from '../../config';
import { isEven, union } from '../../utils';

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
        const light = highlights.filter(light =>
            union({ start: start + i, end: start + i + 1 }, light),
        );
        let selector = 'span';
        if (light.length) {
            const className = this.getHighlightClassName(!!light[0].active);
            selector += `.${className}`;
        }

        if (isEven(i))
            result.push(h(`${selector}.${outerClass}`, chunk));
        else
            result.push(h(`${selector}.${CLASS_NAMES.MU_BACKLASH}`, chunk));
    }

    return result;
}
