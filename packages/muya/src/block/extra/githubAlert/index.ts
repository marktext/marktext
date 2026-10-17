import type { Muya } from '../../../muya';
import type { IGithubAlertState } from '../../../state/types';
import { githubAlertIcon, githubAlertTitle } from '../../../utils/githubAlerts';
import QuoteContainer from '../../base/quoteContainer';

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

    override getState(): IGithubAlertState {
        return { name: 'github-alert', meta: { ...this.meta }, children: this.childStates() };
    }
}
