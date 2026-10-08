import type { ColorFormatType } from '../../utils/colorSpan';
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
import textColorIcon from '../../assets/icons/text_color/2.png';
import { isOsx } from '../../config';

const COMMAND_KEY = isOsx ? '⌘' : 'Ctrl';

const icons = [
    {
        type: 'strong',
        tooltip: 'Emphasize',
        shortcut: `${COMMAND_KEY}+B`,
        icon: strongIcon,
    },
    {
        type: 'em',
        tooltip: 'Italic',
        shortcut: `${COMMAND_KEY}+I`,
        icon: emphasisIcon,
    },
    {
        type: 'u',
        tooltip: 'Underline',
        shortcut: `${COMMAND_KEY}+U`,
        icon: underlineIcon,
    },
    {
        type: 'del',
        tooltip: 'Strikethrough',
        shortcut: `${COMMAND_KEY}+D`,
        icon: strikeIcon,
    },
    {
        type: 'mark',
        tooltip: 'Highlight',
        shortcut: `⇧+${COMMAND_KEY}+H`,
        icon: highlightIcon,
    },
    {
        type: 'color',
        tooltip: 'Text color',
        shortcut: '',
        icon: textColorIcon,
    },
    {
        type: 'inline_code',
        tooltip: 'Inline Code',
        // Default keybinding is Cmd/Ctrl+` (Linux uses Ctrl+Y); was wrongly +E.
        shortcut: `${COMMAND_KEY}+\``,
        icon: codeIcon,
    },
    {
        type: 'inline_math',
        tooltip: 'Inline Math',
        // Default keybinding is Shift+Cmd/Ctrl+M; was wrongly +E.
        shortcut: `⇧+${COMMAND_KEY}+M`,
        icon: mathIcon,
    },
    {
        type: 'link',
        tooltip: 'Link',
        shortcut: `${COMMAND_KEY}+L`,
        icon: linkIcon,
    },
    {
        type: 'image',
        tooltip: 'Image',
        shortcut: `⇧+${COMMAND_KEY}+I`,
        icon: imageIcon,
    },
    {
        type: 'clear',
        tooltip: 'Eliminate',
        shortcut: `⇧+${COMMAND_KEY}+R`,
        icon: clearIcon,
    },
];

export type FormatToolIcon = typeof icons[number];

export interface IColorSwatch {
    /** `#rrggbb`, or `null` for the default / no-colour swatch. */
    value: string | null;
    label: string;
}

export interface IColorSection {
    type: ColorFormatType;
    title: string;
    swatches: IColorSwatch[];
}

export const TEXT_COLOR_SWATCHES: IColorSwatch[] = [
    { value: null, label: 'Default' },
    { value: '#8f959e', label: 'Gray' },
    { value: '#e64340', label: 'Red' },
    { value: '#ed7b2f', label: 'Orange' },
    { value: '#d9a800', label: 'Yellow' },
    { value: '#2ea121', label: 'Green' },
    { value: '#3370ff', label: 'Blue' },
    { value: '#7b61ff', label: 'Purple' },
];

export const BACKGROUND_COLOR_SWATCHES: IColorSwatch[] = [
    { value: null, label: 'No background' },
    { value: '#f2f3f5', label: 'Gray' },
    { value: '#fde2e2', label: 'Red' },
    { value: '#feead2', label: 'Orange' },
    { value: '#fff3c4', label: 'Yellow' },
    { value: '#def5d9', label: 'Green' },
    { value: '#e1eaff', label: 'Blue' },
    { value: '#ede7ff', label: 'Purple' },
    { value: '#dee0e3', label: 'Gray' },
    { value: '#c9cdd4', label: 'Gray' },
    { value: '#fbbfbc', label: 'Red' },
    { value: '#ffd4a8', label: 'Orange' },
    { value: '#ffe58f', label: 'Yellow' },
    { value: '#b7eb8f', label: 'Green' },
    { value: '#a8c0ff', label: 'Blue' },
    { value: '#c9b8ff', label: 'Purple' },
];

export const COLOR_SECTIONS: IColorSection[] = [
    { type: 'color', title: 'Text color', swatches: TEXT_COLOR_SWATCHES },
    {
        type: 'bg_color',
        title: 'Background color',
        swatches: BACKGROUND_COLOR_SWATCHES,
    },
];

export default icons;
