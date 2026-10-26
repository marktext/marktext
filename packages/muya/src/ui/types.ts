import type { OffsetOptions, Placement } from '@floating-ui/dom';

export interface IBaseOptions {
    placement: Placement;
    offsetOptions: OffsetOptions;
    showArrow: boolean;
}

export interface IShortcutHintOptions {
    /** A host provider is authoritative: empty results hide the bundled hint. */
    getShortcut?: (action: string) => string | undefined;
}

export interface IKeyboardShortcutOptions extends IShortcutHintOptions {
    /** Disable command shortcuts when the host owns keyboard dispatch; menu navigation remains enabled. */
    keyboardShortcuts?: boolean;
}
