import type { VNode } from 'snabbdom';
import type Format from '../../block/base/format';
import type { IImageSelectionData } from '../../selection/types';
import type { H, ImageToken, ISyntaxRenderOptions } from '../types';
import type Renderer from './index';
import DeleteIcon from '../../assets/icons/delete/2.png';
import ImageIcon from '../../assets/icons/image/2.png';
import ImageFailIcon from '../../assets/icons/image_fail/2.png';
import { CLASS_NAMES } from '../../config';
import { getImageSrc } from '../../utils/image';

function renderIcon(h: H, className: string, icon: string) {
    const selector = `a.${className}`;
    const iconVnode = h(
        'i.icon',
        h(
            'i.icon-inner',
            {
                style: {
                    'background': `url(${icon}) no-repeat`,
                    'background-size': '100%',
                },
            },
            '',
        ),
    );

    return h(selector, iconVnode);
}

function shouldSyncSelectedImageId(
    selectedImage: IImageSelectionData | null,
    src: string,
    id: string,
): selectedImage is IImageSelectionData {
    return (
        !!selectedImage
        && selectedImage.token.attrs.src === src
        && selectedImage.imageId !== id
    );
}

function isSmallImage(
    naturalWidth: number | undefined,
    naturalHeight: number | undefined,
) {
    return (
        typeof naturalWidth === 'number'
        && typeof naturalHeight === 'number'
        && (naturalWidth < 100 || naturalHeight < 100)
    );
}

function isImageSelected(
    selectedImage: IImageSelectionData | null,
    block: Format,
    token: ImageToken,
    id: string,
) {
    if (!selectedImage)
        return false;

    const { imageId, block: selectedBlock, token: selectedToken } = selectedImage;

    return (
        imageId === `${id}_${token.range.start}`
        && selectedBlock === block
        && selectedToken.range.start === token.range.start
        && selectedToken.range.end === token.range.end
    );
}

// I don't want operate dom directly, is there any better way? need help!
export default function image(
    this: Renderer,
    { h, block, token }: ISyntaxRenderOptions & { token: ImageToken },
) {
    const imageSrc = getImageSrc(token.attrs.src);
    const selectedImage = this.muya.editor.selection.image;
    const { i18n } = this.muya;
    const data = {
        attrs: {
            'contenteditable': 'false',
            'empty-text': i18n.t('Click to add an image'),
            'fail-text': i18n.t('Load image failed'),
        },
        dataset: {
            raw: token.raw,
        },
    };
    let id: string = '';
    let isSuccess: boolean | undefined;
    let naturalWidth: number | undefined;
    let naturalHeight: number | undefined;
    let resolvedUrl: string | undefined;
    // `src` stays the plain path — it is the key the `urlMap`/cache lookups use.
    const src = imageSrc.src;
    const alt = token.attrs.alt;
    const title = token.attrs.title;
    const width = token.attrs.width;
    const height = token.attrs.height;

    if (src) {
        ({ id, isSuccess, url: resolvedUrl, width: naturalWidth, height: naturalHeight }
            = this.loadImageAsync(imageSrc, token.attrs));
    }

    // What the rendered <img> actually points at. For local files this is the
    // cache-busted `file://?mucache=…` URL resolved by `loadImageAsync`, so a
    // block re-render (`innerHTML = html`) re-requests the busted URL instead
    // of the plain path Chromium has cached. Uploads in progress override it
    // with the base64 preview below.
    let imgSrc = resolvedUrl ?? src;

    let wrapperSelector = id
        ? `span#${isSuccess ? `${id}_${token.range.start}` : id}.${
            CLASS_NAMES.MU_INLINE_IMAGE
        }`
        : `span.${CLASS_NAMES.MU_INLINE_IMAGE}`;

    const imageIcons = [
        renderIcon(h, 'mu-image-icon-success', ImageIcon),
        renderIcon(h, 'mu-image-icon-fail', ImageFailIcon),
        renderIcon(h, 'mu-image-icon-close', DeleteIcon),
    ];

    /**
     * The image is used to wrap the img element.
     * @param args
     * @returns The wrapping span VNode containing the image element.
     */
    const renderImageContainer = (...args: VNode[]) => {
        const data = {};
        if (title) {
            Object.assign(data, {
                dataset: { title },
            });
        }

        return h(`span.${CLASS_NAMES.MU_IMAGE_CONTAINER}`, data, args);
    };

    if (typeof token.attrs['data-align'] === 'string')
        wrapperSelector += `.${token.attrs['data-align']}`;

    // the src image is still loading, so use the url Map base64.
    if (this.urlMap.has(src)) {
    // fix: it will generate a new id if the image is not loaded.
        if (shouldSyncSelectedImageId(selectedImage, src, id))
            selectedImage.imageId = id;

        imgSrc = this.urlMap.get(src)!;
        isSuccess = true;
    }

    if (alt.startsWith('loading-')) {
        wrapperSelector += `.${CLASS_NAMES.MU_IMAGE_UPLOADING}`;
        Object.assign(data.dataset, {
            id: alt,
        });
        if (this.urlMap.has(alt)) {
            imgSrc = this.urlMap.get(alt)!;
            isSuccess = true;
        }
    }

    if (src) {
    // image is loading...
        if (typeof isSuccess === 'undefined') {
            wrapperSelector += `.${CLASS_NAMES.MU_IMAGE_LOADING}`;
        }
        else if (isSuccess === true) {
            wrapperSelector += `.${CLASS_NAMES.MU_IMAGE_SUCCESS}`;
            // Tag images whose natural size is below
            // 100px in either dimension. NOTE: no CSS in this package currently
            // consumes `.mu-small-image` — it is kept as a theming hook so
            // downstream stylesheets can shrink/hide the in-wrapper hover icons
            // (`.mu-image-icon-success/fail/close`, each 20×20) that visually
            // clobber a small image. The marktext original wired this class to
            // an in-wrapper `.ag-image-buttons` group that this repo doesn't
            // have (our toolbar is a floating-ui overlay), so the rule lives
            // here as data only; downstream consumers / future PRs own the
            // visual treatment.
            if (isSmallImage(naturalWidth, naturalHeight))
                wrapperSelector += `.${CLASS_NAMES.MU_SMALL_IMAGE}`;
        }
        else {
            wrapperSelector += `.${CLASS_NAMES.MU_IMAGE_FAIL}`;
        }

        // Add image selected class name.
        if (isImageSelected(selectedImage, block, token, id))
            wrapperSelector += `.${CLASS_NAMES.MU_INLINE_IMAGE_SELECTED}`;

        const renderImage = () => {
            const data = {
                props: {
                    alt: alt.replace(/[`*{}[\]()#+\-.!_>~:|<$]/g, ''),
                    src: imgSrc,
                    title,
                },
            };

            if (typeof width === 'string' && width)
                Object.assign(data.props, { width });

            if (typeof height === 'string' && height)
                Object.assign(data.props, { height });

            return h('img', data);
        };

        return isSuccess
            ? [
                    h(wrapperSelector, data, [
                        ...imageIcons,
                        renderImageContainer(
                            // An image description has inline elements as its contents.
                            // When an image is rendered to HTML, this is used as the image’s alt attribute.
                            renderImage(),
                        ),
                    ]),
                ]
            : [h(wrapperSelector, data, [...imageIcons, renderImageContainer()])];
    }
    else {
        wrapperSelector += `.${CLASS_NAMES.MU_EMPTY_IMAGE}`;

        return [h(wrapperSelector, data, [...imageIcons, renderImageContainer()])];
    }
}
