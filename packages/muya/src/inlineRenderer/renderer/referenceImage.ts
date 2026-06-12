import type { ISyntaxRenderOptions, ReferenceImageToken } from '../types';
import type Renderer from './index';
import { CLASS_NAMES } from '../../config';
import { getImageSrc } from '../../utils/image';

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
    const { label, backlash, alt } = token;
    const rawSrc = label + backlash.second;
    let href = '';
    let title = '';
    if (this.parent.labels.has(rawSrc.toLowerCase()))
        ({ href, title } = this.parent.labels.get(rawSrc.toLowerCase())!);

    const imageSrc = getImageSrc(href);
    const { src } = imageSrc;
    let id;
    let isSuccess;
    let resolvedSrc: string | undefined;
    let selector;
    if (src) {
        ({ id, isSuccess, url: resolvedSrc } = this.loadImageAsync(
            imageSrc,
            { alt },
            className,
            CLASS_NAMES.MU_COPY_REMOVE,
        ));
    }
    // `loadImageMap` keys by `src`, so two reference images sharing the same
    // `href` share the same cached `id`.
    // Once the load has resolved (`isSuccess === true`), suffix the DOM id
    // with the token's start offset so each occurrence gets a unique element
    // id. While the load is in flight we keep the raw id so the
    // `document.querySelector('#'+id)` lookup in `loadImageAsync.then()` can
    // still find the first instance to mount the resolved <img> into.
    selector = id
        ? `span#${isSuccess ? `${id}_${token.range.start}` : id}.${imageClass}`
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
