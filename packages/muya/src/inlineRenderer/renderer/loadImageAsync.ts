import type { ImageResources } from '../resources/images';
import { getUniqueId } from '../../utils';
import { mountImage } from '../resources/mountImage';

interface IImageRenderHost {
    images: ImageResources;
    loadImageMap: ImageResources['loaded'];
    muya: { domNode: HTMLElement };
}

export default function loadImageAsync(
    this: IImageRenderHost,
    imageInfo: { isUnknownType: boolean; src: string },
    attrs: Record<string, string>,
    className?: string,
    imageClass?: string,
) {
    const { src, isUnknownType } = imageInfo;
    const cached = this.loadImageMap.get(src);
    // Each render occurrence owns its placeholder, even when requests are shared.
    const id = getUniqueId();
    if (cached?.isSuccess)
        return { ...cached, id };

    const root = this.muya.domNode;
    void this.images.request(src, isUnknownType).then((result) => {
        if (!result || this.loadImageMap.get(src) !== result)
            return;
        const placeholder = root.querySelector<HTMLElement>(`#${id}`);
        if (placeholder)
            mountImage(placeholder, result, attrs, className, imageClass);
    });
    return { id, isSuccess: undefined, url: undefined, width: undefined, height: undefined };
}
