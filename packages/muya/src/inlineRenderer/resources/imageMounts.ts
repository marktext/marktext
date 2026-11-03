import type { ILoadedImage } from './images';
import { getUniqueId } from '../../utils';

/** Pending callbacks belong to a block render and are released on replacement/removal. */
export class ImageMounts {
    private _bindings = new Map<string, { scope: HTMLElement; apply: (result: ILoadedImage) => void }>();

    watch(scope: HTMLElement, request: Promise<ILoadedImage | null>, apply: (result: ILoadedImage) => void): string {
        const id = getUniqueId();
        this._bindings.set(id, { scope, apply });
        void request.then((result) => {
            const binding = this._bindings.get(id);
            this._bindings.delete(id);
            if (binding && result)
                binding.apply(result);
        });
        return id;
    }

    release(scope: HTMLElement): void {
        for (const [id, binding] of this._bindings) {
            if (binding.scope === scope || scope.contains(binding.scope))
                this._bindings.delete(id);
        }
    }

    clear(): void {
        this._bindings.clear();
    }
}
