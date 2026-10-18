import { githubAlertIcon, githubAlertType } from '../utils/githubAlerts';
import { h } from '../utils/snabbdom';

export function renderMenuIcon({ label, icon }: { label: string; icon: string }) {
    const type = label.startsWith('github-alert ') ? githubAlertType(label.slice('github-alert '.length)) : null;
    if (type) {
        return h('i.icon.mu-alert-menu-icon', {
            props: { innerHTML: githubAlertIcon(type) },
        });
    }
    return h(
        'i.icon',
        h(
            `i.icon-${label.replace(/\s/g, '-')}`,
            {
                style: {
                    'background': `url(${icon}) no-repeat`,
                    'background-size': '100%',
                },
            },
            '',
        ),
    );
}
