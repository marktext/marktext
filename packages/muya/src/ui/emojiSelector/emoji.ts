import type { Emoji as EmojiType } from '../../config/emojis';
import Fuse from 'fuse.js';
import emojis from '../../config/emojis';

const emojisForSearch: Record<string, EmojiType[]> = {};

for (const emoji of emojis) {
    if (emojisForSearch[emoji.category])
        emojisForSearch[emoji.category].push(emoji);
    else
        emojisForSearch[emoji.category] = [emoji];
}

class Emoji {
    // cache key is the search text, and the value is search results by category.
    private _cache: Map<string, Record<string, EmojiType[]>> = new Map();

    search(text: string): Record<string, EmojiType[]> {
        const { _cache: cache } = this;
        if (cache.has(text))
            return cache.get(text)!;

        const result: Record<string, EmojiType[]> = {};

        Object.keys(emojisForSearch).forEach((category) => {
            const fuse = new Fuse(emojisForSearch[category], {
                includeScore: true,
                keys: ['aliases', 'tags'],
            });
            const list = fuse.search(text).map(i => i.item);
            if (list.length)
                result[category] = list;
        });
        cache.set(text, result);

        return result;
    }

    destroy() {
        return this._cache.clear();
    }
}

export default Emoji;
