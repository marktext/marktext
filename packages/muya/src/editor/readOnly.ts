import type { Muya } from '../muya';
import { getLinkInfo } from '../utils/getLinkInfo';
import { LINK_SELECTOR } from './linkMouseEvents';

export function prepareReadingLinks(container: HTMLElement): void {
    for (const link of container.querySelectorAll<HTMLElement>(`${LINK_SELECTOR}, a[href]`)) {
        const href = getLinkInfo(link)?.href ?? link.getAttribute('href');
        if (!href)
            continue;
        link.setAttribute('href', href);
        link.setAttribute('tabindex', '0');
        link.setAttribute('role', 'link');
    }
}

function getReadingImage(target: Element): HTMLImageElement | null {
    const image = target.closest<HTMLImageElement>('img');
    return image && !image.closest('button, [role="button"], .mu-icon') ? image : null;
}

export function attachReadingEvents(muya: Muya): () => void {
    const { domNode, eventCenter } = muya;
    let linkTimer: ReturnType<typeof setTimeout> | undefined;
    const cancelLink = () => clearTimeout(linkTimer);
    const attach = (type: string, handler: EventListener) => {
        eventCenter.attachDOMEvent(domNode, type, (event) => {
            if (muya.isReadOnly)
                handler(event);
        }, true);
    };
    const blockMutation = (event: Event) => {
        event.preventDefault();
        event.stopImmediatePropagation();
    };
    const activate = (event: Event) => {
        if (!(event.target instanceof Element))
            return;
        // DiagramPreview owns activation, including links and PlantUML images inside it.
        if (event.target.closest('.mu-diagram-preview'))
            return;
        const link = event.target.closest<HTMLElement>(`${LINK_SELECTOR}, a[href]`);
        if (!link) {
            const image = getReadingImage(event.target);
            if (event instanceof MouseEvent && image)
                eventCenter.emit('preview-image', { data: image.src });
            return;
        }
        event.preventDefault();
        event.stopImmediatePropagation();
        cancelLink();
        const followLink = () => {
            if (muya.isReadOnly && domNode.isConnected && domNode.contains(link)) {
                eventCenter.emit('format-click', {
                    event,
                    formatType: 'link',
                    data: getLinkInfo(link) ?? { href: link.getAttribute('href') },
                });
            }
        };
        if (event instanceof KeyboardEvent)
            followLink();
        else if (event instanceof MouseEvent && event.detail <= 1 && document.getSelection()?.isCollapsed !== false)
            linkTimer = setTimeout(followLink, 300);
    };

    for (const type of ['beforeinput', 'paste', 'cut', 'drop', 'dragover'])
        attach(type, blockMutation);
    attach('click', activate);
    attach('dblclick', cancelLink);
    attach('keydown', (event) => {
        if (!(event instanceof KeyboardEvent))
            return;
        if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'a') {
            event.preventDefault();
            muya.selectAll();
        }
        else if (event.key === 'Enter') {
            activate(event);
        }
    });
    attach('contextmenu', (event) => {
        if (!(event.target instanceof Element))
            return;
        const link = event.target.closest<HTMLElement>(`${LINK_SELECTOR}, a[href]`);
        event.preventDefault();
        eventCenter.emit('reading-context-menu', {
            event,
            href: link ? (getLinkInfo(link)?.href ?? link.getAttribute('href')) : null,
            image: getReadingImage(event.target)?.src,
        });
    });
    // EventCenter owns DOM listener cleanup; only the delayed activation needs separate disposal.
    return cancelLink;
}
