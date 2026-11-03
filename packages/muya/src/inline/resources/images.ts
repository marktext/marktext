import { getUniqueId } from '../../utils';
import { loadImage } from '../../utils/image';

export interface ILoadedImage {
    readonly id: string;
    readonly isSuccess: boolean;
    readonly url?: string;
    readonly width?: number;
    readonly height?: number;
}

type ImageState = { status: 'pending'; request: Promise<ILoadedImage | null> }
    | { status: 'ready' | 'failed'; result: ILoadedImage };

/** Resource identity is independent of DOM occurrences; failed loads remain retryable. */
export class ImageResources {
    private _states = new Map<string, ImageState>();
    private _previews = new Map<string, string>();
    private _disposed = false;

    get size(): number {
        return this._states.size;
    }

    get(src: string): ILoadedImage | undefined {
        const state = this._states.get(src);
        return state && state.status !== 'pending' ? state.result : undefined;
    }

    getPreview(src: string): string | undefined {
        return this._previews.get(src);
    }

    setPreview(src: string, preview: string): void {
        if (!this._disposed)
            this._previews.set(src, preview);
    }

    request(src: string, detectContentType: boolean): Promise<ILoadedImage | null> {
        if (this._disposed)
            return Promise.resolve(null);
        const state = this._states.get(src);
        if (state?.status === 'ready')
            return Promise.resolve(state.result);
        if (state?.status === 'pending')
            return state.request;
        const id = getUniqueId();
        // Only the load URL is busted; repeated renders share the original key.
        const loadSrc = /^file:\/\//i.test(src)
            ? `${src}${src.includes('?') ? '&' : '?'}mucache=${id}`
            : src;
        const request = loadImage(loadSrc, detectContentType).then(
            result => ({ id, isSuccess: true, ...result }),
            () => ({ id, isSuccess: false }),
        ).then((result) => {
            const current = this._states.get(src);
            // Invalidated requests cannot repopulate caches or update DOM.
            if (current?.status !== 'pending' || current.request !== request)
                return null;
            this._previews.delete(src);
            this._states.set(src, { status: result.isSuccess ? 'ready' : 'failed', result });
            return result;
        });
        this._states.set(src, { status: 'pending', request });
        return request;
    }

    invalidate(): void {
        this._states.clear();
        this._previews.clear();
    }

    dispose(): void {
        this._disposed = true;
        this.invalidate();
    }
}
