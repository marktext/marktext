import type { Muya } from '../muya';
import type BaseFloat from './baseFloat';

export class Ui {
    public shownFloat: Set<BaseFloat> = new Set();
    public shownButton: Set<BaseFloat> = new Set();

    constructor(public muya: Muya) {
        this.listen();
    }

    listen() {
    // cache shown float box
        this.muya.eventCenter.subscribe('muya-float', (tool, status) => {
            status ? this.shownFloat.add(tool) : this.shownFloat.delete(tool);
        });
        // cache shown btn
        this.muya.eventCenter.subscribe('muya-float-button', (tool, status) => {
            status ? this.shownButton.add(tool) : this.shownButton.delete(tool);
        });
    }

    hideAllFloatTools() {
        for (const tool of this.shownFloat)
            tool.hide();

        for (const btn of this.shownButton)
            btn.hide();
    }
}
