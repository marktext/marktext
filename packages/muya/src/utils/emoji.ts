import { CLASS_NAMES } from '../config';
import emojis from '../config/emojis';

/**
 * check if one emoji code is in emojis, return undefined or found emoji
 */
export function validEmoji(text: string) {
    return emojis.find((emoji) => {
        return emoji.aliases.includes(text);
    });
}

/**
 * check edit emoji
 */

export function checkEditEmoji(node: HTMLElement) {
    if (node && node.classList.contains(CLASS_NAMES.MU_EMOJI_MARKED_TEXT))
        return node;

    return false;
}
