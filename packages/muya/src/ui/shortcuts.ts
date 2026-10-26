import type { IShortcutHintOptions } from './types';

export function getShortcutHint(options: IShortcutHintOptions, action: string, fallback = ''): string {
    return options.getShortcut ? options.getShortcut(action) ?? '' : fallback;
}
