import type { ILoadedImage } from './images';
import { getUniqueId } from '../../utils';

interface IImageBinding {
    scope: HTMLElement;
    apply: (placeholder: HTMLElement, result: ILoadedImage) => void;
}

/** Pending callbacks follow their placeholders within one editor, including synchronous DOM moves. */
export class ImageMounts {
    private _bindings = new Map<string, IImageBinding>();
    private _observer: MutationObserver | null = null;
    private _pruneScheduled = false;
    private _disposed = false;

    constructor(private _root: HTMLElement) {}

    get size(): number {
        return this._bindings.size;
    }

    /** The returned ID must be mounted in scope before the next microtask. */
    watch(scope: HTMLElement, request: Promise<ILoadedImage | null>, apply: IImageBinding['apply']): string {
        const id = getUniqueId();
        if (this._disposed)
            return id;
        this._bindings.set(id, { scope, apply });
        if (!this._observer) {
            this._observer = new MutationObserver((records) => {
                if (records.some(record => record.removedNodes.length > 0))
                    this._prune();
            });
            this._observer.observe(this._root, { childList: true, subtree: true });
        }
        // Rendering may be abandoned before any DOM mutation reaches the observer.
        if (!this._pruneScheduled) {
            this._pruneScheduled = true;
            queueMicrotask(() => {
                this._pruneScheduled = false;
                this._prune();
            });
        }
        void request.then((result) => {
            const binding = this._bindings.get(id);
            this._bindings.delete(id);
            this._disconnectIfIdle();
            if (!binding || !result)
                return;
            // Completion can run before the observer delivers a pending removal.
            const placeholder = this._placeholder(id, binding);
            if (placeholder?.isConnected)
                binding.apply(placeholder, result);
        });
        return id;
    }

    private _placeholder(id: string, binding: IImageBinding): HTMLElement | null {
        return this._root.contains(binding.scope) ? binding.scope.querySelector<HTMLElement>(`#${id}`) : null;
    }

    private _prune(): void {
        for (const [id, binding] of this._bindings) {
            if (!this._placeholder(id, binding))
                this._bindings.delete(id);
        }
        this._disconnectIfIdle();
    }

    private _disconnectIfIdle(): void {
        if (this._bindings.size === 0) {
            this._observer?.disconnect();
            this._observer = null;
        }
    }

    clear(): void {
        this._bindings.clear();
        this._disconnectIfIdle();
    }

    dispose(): void {
        this._disposed = true;
        this.clear();
    }
}
