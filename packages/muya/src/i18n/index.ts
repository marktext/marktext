import type { Muya } from '../muya';
import type { ILocale } from './types';

import { en } from '../locales/en';

class I18n {
    public lang: string;
    private _resources: Record<string, ILocale['resource']>;

    constructor(_muya: Muya, object: ILocale) {
        const { name, resource } = object || en;
        this.lang = name;
        this._resources = {
            [name]: resource,
        };
    }

    t(key: string): string {
        const { lang } = this;
        const resources = this._resources;

        return resources?.[lang]?.[key] || resources?.en?.[key] || key;
    }

    locale(object: ILocale) {
        const { name, resource } = object;
        this.lang = name;
        this._resources = {
            ...this._resources,
            [name]: resource,
        };
    }
}

export default I18n;
