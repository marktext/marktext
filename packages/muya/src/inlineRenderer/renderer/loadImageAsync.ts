import type Renderer from './index';
import { CLASS_NAMES } from '../../config';
import { getUniqueId } from '../../utils';
import { insertAfter, operateClassName } from '../../utils/dom';
import { loadImage } from '../../utils/image';

export default function loadImageAsync(
    this: Renderer,
    imageInfo: {
        isUnknownType: boolean;
        src: string;
    },
    attrs: Record<string, string>,
    className?: string,
    imageClass?: string,
) {
    const { src, isUnknownType } = imageInfo;
    let id: string;
    let isSuccess: boolean | undefined;
    let url: string | undefined;
    let w;
    let h;

    const cached = this.loadImageMap.get(src);
    // Retry when the previous load failed: a transient failure should not
    // permanently poison the cache (marktext#3001 / #3010, commit bca2ed62).
    if (!cached || !cached.isSuccess) {
        id = getUniqueId();
        loadImage(src, isUnknownType)
            .then(({ url, width, height }) => {
                const imageText: HTMLElement | null = document.querySelector(`#${id}`);
                const img = document.createElement('img');
                img.src = url;
                if (attrs.alt)
                    img.alt = attrs.alt.replace(/[`*{}[\]()#+\-.!_>~:|<$]/g, '');
                if (attrs.title)
                    img.setAttribute('title', attrs.title);
                if (attrs.width && typeof attrs.width === 'number')
                    img.setAttribute('width', attrs.width);

                if (attrs.height && typeof attrs.height === 'number')
                    img.setAttribute('height', attrs.height);

                if (imageClass)
                    img.classList.add(imageClass);

                if (imageText) {
                    if (imageText.classList.contains(`${CLASS_NAMES.MU_INLINE_IMAGE}`)) {
                        const imageContainer = imageText.querySelector(
                            `.${CLASS_NAMES.MU_IMAGE_CONTAINER}`,
                        );
                        const oldImage = imageContainer!.querySelector('img');
                        if (oldImage)
                            oldImage.remove();

                        imageContainer!.appendChild(img);
                        imageText.classList.remove(CLASS_NAMES.MU_IMAGE_LOADING);
                        imageText.classList.add(CLASS_NAMES.MU_IMAGE_SUCCESS);
                        // Tag small images on the first async load — otherwise the class
                        // would only appear on the next re-render after the cache is
                        // populated. See `image.ts` for why the class is kept as a theming
                        // hook with no in-package CSS consumer; downstream stylesheets own
                        // the visual treatment.
                        if (width < 100 || height < 100)
                            imageText.classList.add(CLASS_NAMES.MU_SMALL_IMAGE);
                    }
                    else {
                        insertAfter(img, imageText);
                        if (className)
                            operateClassName(imageText, 'add', className);
                    }
                }

                if (this.urlMap.has(src))
                    this.urlMap.delete(src);

                this.loadImageMap.set(src, {
                    id,
                    isSuccess: true,
                    url,
                    width,
                    height,
                });
            })
            .catch(() => {
                const imageText: HTMLElement | null = document.querySelector(`#${id}`);
                if (imageText) {
                    operateClassName(imageText, 'remove', CLASS_NAMES.MU_IMAGE_LOADING);
                    operateClassName(imageText, 'add', CLASS_NAMES.MU_IMAGE_FAIL);
                    const image = imageText.querySelector('img');
                    if (image)
                        image.remove();
                }

                if (this.urlMap.has(src))
                    this.urlMap.delete(src);

                this.loadImageMap.set(src, {
                    id,
                    isSuccess: false,
                });
            });
    }
    else {
        id = cached.id;
        isSuccess = cached.isSuccess;
        url = cached.url;
        w = cached.width;
        h = cached.height;
    }

    // marktext's loadImageAsync returns `domsrc` (the resolved URL — for
    // remote sources it's just the src, for local files it carries a cache-
    // busting query). Reference images need this so the rendered <img> uses
    // the resolved URL rather than the raw label-derived href.
    return { id, isSuccess, url, width: w, height: h };
}
