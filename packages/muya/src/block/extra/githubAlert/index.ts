import type { Muya } from '../../../muya';
import type { IGithubAlertState } from '../../../state/types';
import type Content from '../../base/content';
import type Parent from '../../base/parent';
import { githubAlertIcon, githubAlertTitle } from '../../../utils/githubAlerts';
import QuoteContainer from '../../base/quoteContainer';
import { convertGithubAlert } from '../../githubAlerts';

export default class GithubAlert extends QuoteContainer {
    static override blockName = 'github-alert';
    public meta: IGithubAlertState['meta'];

    static create(muya: Muya, state: IGithubAlertState) {
        const alert = new GithubAlert(muya, state);
        alert.loadChildren(state.children);
        return alert;
    }

    constructor(muya: Muya, state: IGithubAlertState) {
        super(muya);
        this.meta = { ...state.meta };
        this.tagName = 'blockquote';
        this.classList = ['mu-block-quote', 'mu-github-alert'];
        this.datasets = { alertType: this.meta.type.toLowerCase() };
        this.createDomNode();
        const title = document.createElement('div');
        title.className = 'mu-alert-title';
        title.contentEditable = 'false';
        title.innerHTML = githubAlertIcon(this.meta.type);
        title.append(githubAlertTitle(this.meta.type));
        this.domNode!.append(title);
    }

    override backspaceAtStart(content: Content, event: KeyboardEvent): boolean {
        if (event.metaKey || event.ctrlKey || event.altKey || content.parent !== this.firstChild)
            return false;
        const cursor = content.getCursor();
        if (cursor?.start.offset !== 0 || cursor.end.offset !== 0)
            return false;
        event.preventDefault();
        event.stopPropagation();
        convertGithubAlert(this, 'block-quote');
        return true;
    }

    override exitEmptyParagraph(paragraph: Parent) {
        if (this.getState().children.every(child => child.name === 'paragraph' && !child.text.trim()))
            convertGithubAlert(this, 'paragraph');
        else
            super.exitEmptyParagraph(paragraph);
    }

    override getState(): IGithubAlertState {
        return { name: 'github-alert', meta: { ...this.meta }, children: this.childStates() };
    }
}
