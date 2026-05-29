import type { Muya } from '../../../muya';
import type { IHtmlBlockState } from '../../../state/types';
import type { TBlockPath } from '../../types';
import { CLASS_NAMES } from '../../../config';
import Parent from '../../base/parent';
import { ScrollPage } from '../../scrollPage';

class HTMLBlock extends Parent {
    static override blockName = 'html-block';

    static create(muya: Muya, state: IHtmlBlockState) {
        const htmlBlock = new HTMLBlock(muya);

        const htmlPreview = ScrollPage.loadBlock('html-preview').create(
            muya,
            state,
        );
        const htmlContainer = ScrollPage.loadBlock('html-container').create(
            muya,
            state,
        );

        htmlBlock.appendAttachment(htmlPreview);
        htmlBlock.append(htmlContainer);

        return htmlBlock;
    }

    override get path() {
        const { path: pPath } = this.parent!;
        const offset = this.parent!.offset(this);

        return [...pPath, offset];
    }

    constructor(muya: Muya) {
        super(muya);
        this.tagName = 'figure';
        this.classList = [CLASS_NAMES.MU_HTML_BLOCK];
        const { disableHtml } = muya.options;
        if (disableHtml)
            this.classList.push(CLASS_NAMES.MU_DISABLE_HTML_RENDER);

        this.createDomNode();
    }

    queryBlock(path: TBlockPath) {
        return path.length && path[0] === 'text'
            ? this.firstContentInDescendant()
            : this;
    }

    override getState(): IHtmlBlockState {
        const state: IHtmlBlockState = {
            name: 'html-block',
            text: this.firstContentInDescendant()?.text ?? '',
        };

        return state;
    }
}

export default HTMLBlock;
