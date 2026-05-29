import type { Muya } from '../muya';
import type { ILocale } from './types';

import { en } from '../locales/en';

class I18n {
    public lang: string;
    public resources: Record<string, ILocale['resource']>;

    constructor(public muya: Muya, object: ILocale) {
        const { name, resource } = object || en;
        this.lang = name;
        this.resources = {
            [name]: resource,
        };
    }

    t(key: string): string {
        const { lang, resources } = this;

        return resources?.[lang]?.[key] || resources.en[key] || key;
    }

    locale(object: ILocale) {
        const { name, resource } = object;
        this.lang = name;
        this.resources = {
            ...this.resources,
            [name]: resource,
        };
    }
}

export default I18n;
