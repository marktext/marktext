import type { ImageMounts } from '../resources/imageMounts';
import type { ImageResources } from '../resources/images';
import { getUniqueId } from '../../utils';
import { mountImage } from '../resources/mountImage';

interface IImageRenderHost {
    images: ImageResources;
    mounts: ImageMounts;
    environment: { root: HTMLElement };
}

export default function loadImageAsync(
    this: IImageRenderHost,
    imageInfo: { isUnknownType: boolean; src: string },
    attrs: Record<string, string>,
    className?: string,
    imageClass?: string,
) {
    const { src, isUnknownType } = imageInfo;
    const cached = this.images.get(src);
    // Each render occurrence owns its placeholder, even when requests are shared.
    if (cached?.isSuccess)
        return { ...cached, id: getUniqueId() };

    const root = this.environment.root;
    const id = this.mounts.watch(root, this.images.request(src, isUnknownType), (placeholder, result) => {
        if (this.images.get(src) !== result)
            return;
        mountImage(placeholder, result, attrs, className, imageClass);
    });
    return { id, isSuccess: undefined, url: undefined, width: undefined, height: undefined };
}
