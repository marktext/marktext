import type { Muya } from '../muya';
import type BaseFloat from './baseFloat';
import { EVENT_KEYS } from '../config';

const CONTENT_NAV_KEYS = new Set([
    EVENT_KEYS.Enter,
    EVENT_KEYS.Escape,
    EVENT_KEYS.Tab,
    EVENT_KEYS.ArrowUp,
    EVENT_KEYS.ArrowDown,
]);

export class Ui {
    public shownFloat: Set<BaseFloat> = new Set();
    private _shownButton: Set<BaseFloat> = new Set();

    constructor(public muya: Muya) {
        this._listen();
    }

    private _listen() {
    // cache shown float box
        this.muya.eventCenter.subscribe('muya-float', (tool, status) => {
            status ? this.shownFloat.add(tool) : this.shownFloat.delete(tool);
        });
        // cache shown btn
        this.muya.eventCenter.subscribe('muya-float-button', (tool, status) => {
            status ? this._shownButton.add(tool) : this._shownButton.delete(tool);
        });
    }

    hideAllFloatTools() {
        for (const tool of this.shownFloat)
            tool.hide();

        for (const btn of this._shownButton)
            btn.hide();
    }

    handleContentKeydown(event: KeyboardEvent): boolean {
        if (this.shownFloat.size === 0 || !CONTENT_NAV_KEYS.has(event.key))
            return false;

        if (
            event.shiftKey
            && (event.key === EVENT_KEYS.ArrowUp || event.key === EVENT_KEYS.ArrowDown)
        ) {
            return false;
        }

        for (const tool of this.shownFloat) {
            if (tool.capturesContentKeydown) {
                event.preventDefault();
                break;
            }
        }

        return true;
    }
}
