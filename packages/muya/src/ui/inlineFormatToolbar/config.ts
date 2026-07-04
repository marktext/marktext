import codeIcon from '../../assets/icons/code/2.png';
import clearIcon from '../../assets/icons/format_clear/2.png';
import emphasisIcon from '../../assets/icons/format_emphasis/2.png';
import imageIcon from '../../assets/icons/format_image/2.png';
import linkIcon from '../../assets/icons/format_link/2.png';
import mathIcon from '../../assets/icons/format_math/2.png';
import strikeIcon from '../../assets/icons/format_strike/2.png';
import strongIcon from '../../assets/icons/format_strong/2.png';
import underlineIcon from '../../assets/icons/format_underline/2.png';
import highlightIcon from '../../assets/icons/highlight/2.png';
import { isOsx } from '../../config';

const COMMAND_KEY = isOsx ? '⌘' : 'Ctrl';

/**
 * One toolbar button plus its DEFAULT shortcut: `shortcut` is the tooltip
 * hint, `key`/`shiftKey` what the internal Cmd/Ctrl-gated keydown handler
 * matches. Both are overridable per format type via the
 * `inlineFormatShortcuts` muya option — these values only apply when the
 * embedder passes no override.
 */
export interface IFormatToolIcon {
    type: string;
    tooltip: string;
    shortcut: string;
    key: string;
    shiftKey?: boolean;
    icon: string;
}

const icons: IFormatToolIcon[] = [
    {
        type: 'strong',
        tooltip: 'Emphasize',
        shortcut: `${COMMAND_KEY}+B`,
        key: 'b',
        icon: strongIcon,
    },
    {
        type: 'em',
        tooltip: 'Italic',
        shortcut: `${COMMAND_KEY}+I`,
        key: 'i',
        icon: emphasisIcon,
    },
    {
        type: 'u',
        tooltip: 'Underline',
        shortcut: `${COMMAND_KEY}+U`,
        key: 'u',
        icon: underlineIcon,
    },
    {
        type: 'del',
        tooltip: 'Strikethrough',
        shortcut: `${COMMAND_KEY}+D`,
        key: 'd',
        icon: strikeIcon,
    },
    {
        type: 'mark',
        tooltip: 'Highlight',
        shortcut: `⇧+${COMMAND_KEY}+H`,
        key: 'h',
        shiftKey: true,
        icon: highlightIcon,
    },
    {
        type: 'inline_code',
        tooltip: 'Inline Code',
        // Default keybinding is Cmd/Ctrl+` (Linux uses Ctrl+Y); was wrongly +E.
        shortcut: `${COMMAND_KEY}+\``,
        key: '`',
        icon: codeIcon,
    },
    {
        type: 'inline_math',
        tooltip: 'Inline Math',
        // Default keybinding is Shift+Cmd/Ctrl+M; was wrongly +E.
        shortcut: `⇧+${COMMAND_KEY}+M`,
        key: 'm',
        shiftKey: true,
        icon: mathIcon,
    },
    {
        type: 'link',
        tooltip: 'Link',
        shortcut: `${COMMAND_KEY}+L`,
        key: 'l',
        icon: linkIcon,
    },
    {
        type: 'image',
        tooltip: 'Image',
        shortcut: `⇧+${COMMAND_KEY}+I`,
        key: 'i',
        shiftKey: true,
        icon: imageIcon,
    },
    {
        type: 'clear',
        tooltip: 'Eliminate',
        shortcut: `⇧+${COMMAND_KEY}+R`,
        key: 'r',
        shiftKey: true,
        icon: clearIcon,
    },
];

export type FormatToolIcon = IFormatToolIcon;

export default icons;
