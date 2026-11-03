import type { ReferenceImageToken } from '../model/types';
import type Renderer from './index';
import type { ISyntaxRenderOptions } from './types';
import { CLASS_NAMES } from '../../config';
import { getImageSrc } from '../../utils/image';
import { normalizeReferenceLabel } from '../referenceLabel';

// reference_image
export default function referenceImage(
    this: Renderer,
    {
        h,
        cursor,
        block,
        token,
        outerClass,
    }: ISyntaxRenderOptions & { token: ReferenceImageToken },
) {
    const className = this.getClassName(outerClass, block, token, cursor);
    const imageClass = CLASS_NAMES.MU_IMAGE_MARKED_TEXT;
    const { start, end } = token.range;
    const tag = this.highlight(h, block, start, end, token);
    const { label, backlash, attrs: { alt } } = token;
    const rawSrc = label + backlash.second;
    const { href = '', title = '' } = this.environment.references.get(normalizeReferenceLabel(rawSrc)) ?? {};

    const imageSrc = getImageSrc(href);
    const { src } = imageSrc;
    let id;
    let isSuccess;
    let resolvedSrc: string | undefined;
    let selector;
    if (src) {
        ({ id, isSuccess, url: resolvedSrc } = this.loadImageAsync(
            imageSrc,
            { alt, title },
            className,
            CLASS_NAMES.MU_COPY_REMOVE,
        ));
    }
    selector = id
        ? `span#${id}.${imageClass}`
        : `span.${imageClass}`;
    selector += `.${CLASS_NAMES.MU_OUTPUT_REMOVE}`;
    if (isSuccess)
        selector += `.${className}`;
    else
        selector += `.${CLASS_NAMES.MU_IMAGE_FAIL}`;

    return isSuccess
        ? [
                h(selector, tag),
                // Prefer the resolved URL from the loadImageAsync cache; fall
                // back to the raw src if the cache hasn't been populated for
                // some reason.
                h(`img.${CLASS_NAMES.MU_COPY_REMOVE}`, { props: { alt, src: resolvedSrc ?? src, title } }),
            ]
        : [h(selector, tag)];
}
