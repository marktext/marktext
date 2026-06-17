import type { Muya } from '../muya';
import type BaseFloat from './baseFloat';

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
}
