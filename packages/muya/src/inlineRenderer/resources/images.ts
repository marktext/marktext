import { getUniqueId } from '../../utils';
import { loadImage } from '../../utils/image';

export interface ILoadedImage {
    id: string;
    isSuccess: boolean;
    url?: string;
    width?: number;
    height?: number;
}

/** Resource identity is independent of the number of DOM occurrences. */
export class ImageResources {
    readonly loaded = new Map<string, ILoadedImage>();
    readonly previews = new Map<string, string>();
    private _pending = new Map<string, Promise<ILoadedImage | null>>();

    request(src: string, detectContentType: boolean): Promise<ILoadedImage | null> {
        const cached = this.loaded.get(src);
        if (cached?.isSuccess)
            return Promise.resolve(cached);
        const pending = this._pending.get(src);
        if (pending)
            return pending;
        const id = getUniqueId();
        // Only the load URL is busted; repeated renders still share the original key.
        const loadSrc = /^file:\/\//i.test(src)
            ? `${src}${src.includes('?') ? '&' : '?'}mucache=${id}`
            : src;
        const request = loadImage(loadSrc, detectContentType).then(
            result => ({ id, isSuccess: true, ...result }),
            () => ({ id, isSuccess: false }),
        ).then((result) => {
            // Invalidated or destroyed requests cannot repopulate caches or update DOM.
            if (this._pending.get(src) !== request)
                return null;
            this._pending.delete(src);
            this.previews.delete(src);
            this.loaded.set(src, result);
            return result;
        });
        this._pending.set(src, request);
        return request;
    }

    invalidate(): void {
        this._pending.clear();
        this.loaded.clear();
        this.previews.clear();
    }
}
