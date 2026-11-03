import type { ILoadedImage } from './images';
import { CLASS_NAMES } from '../../config';
import { insertAfter, operateClassName } from '../../utils/dom';
import { usesDefaultObjectSize } from '../../utils/image';

export function mountImage(imageText: HTMLElement, result: ILoadedImage, attrs: Record<string, string>, className?: string, imageClass?: string): void {
    const { url, width, height } = result;
    if (!result.isSuccess || !url) {
        operateClassName(imageText, 'remove', CLASS_NAMES.MU_IMAGE_LOADING);
        operateClassName(imageText, 'add', CLASS_NAMES.MU_IMAGE_FAIL);
        imageText.querySelector('img')?.remove();
        return;
    }
    const img = createImage(url, width, height, attrs, imageClass);

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
        // Host themes use this hook on the first load as well as cached renders.
        if ((width ?? 0) < 100 || (height ?? 0) < 100)
            imageText.classList.add(CLASS_NAMES.MU_SMALL_IMAGE);
    }
    else {
        insertAfter(img, imageText);
        if (className)
            operateClassName(imageText, 'add', className);
    }
}

function createImage(url: string, width: number | undefined, height: number | undefined, attrs: Record<string, string>, imageClass?: string) {
    const img = document.createElement('img');
    img.src = url;

    const NUM_REG = /^\d+$/;

    if (attrs.alt)
        img.alt = attrs.alt;

    if (attrs.title)
        img.setAttribute('title', attrs.title);

    if (attrs.width && NUM_REG.test(attrs.width))
        img.setAttribute('width', attrs.width);

    if (attrs.height && NUM_REG.test(attrs.height))
        img.setAttribute('height', attrs.height);

    // ViewBox-only SVGs otherwise collapse in the shrink-to-fit container (#4991).
    if (!attrs.width && !attrs.height && usesDefaultObjectSize(width ?? 0, height ?? 0))
        img.style.width = `${width}px`;

    if (imageClass)
        img.classList.add(imageClass);

    return img;
}
