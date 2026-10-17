import type { MarkedExtension } from 'marked';
import { GITHUB_ALERT_IGNORE_CLASS, matchGithubAlertMarker } from '../../githubAlerts';

export default function githubAlertsExtension(enabled: boolean): MarkedExtension {
    if (!enabled)
        return {};

    return {
        renderer: {
            blockquote({ tokens }) {
                const first = tokens.find(token => token.type !== 'space');
                if (first?.type === 'paragraph' && matchGithubAlertMarker(first.text.split('\n', 1)[0]))
                    return false;

                // Rendered inline nodes lose source-line boundaries, including
                // the distinction between Markdown hard breaks and literal <br>.
                return `<blockquote class="${GITHUB_ALERT_IGNORE_CLASS}">\n${this.parser.parse(tokens)}</blockquote>\n`;
            },
        },
    };
}
