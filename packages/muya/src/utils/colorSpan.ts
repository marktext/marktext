export type ColorFormatType = 'color' | 'bg_color';

export interface IColorStyle {
    color: string | null;
    backgroundColor: string | null;
}

const COLOR_PROPERTY = 'color';
const BACKGROUND_COLOR_PROPERTY = 'background-color';

export const COLOR_SPAN_CLOSE_TAG = '</span>';

const COLOR_PROPERTY_BY_TYPE: Record<ColorFormatType, string> = {
    color: COLOR_PROPERTY,
    bg_color: BACKGROUND_COLOR_PROPERTY,
};

export function colorPropertyOf(type: ColorFormatType): string {
    return COLOR_PROPERTY_BY_TYPE[type];
}

// `null` for a style that carries anything other than colour declarations —
// such a span (pasted or hand-written) is not ours to rewrite.
export function parseColorStyle(
    style: string | null | undefined,
): IColorStyle | null {
    if (!style || !style.trim())
        return null;

    const result: IColorStyle = { color: null, backgroundColor: null };
    let matched = false;

    for (const declaration of style.split(';')) {
        const fragment = declaration.trim();
        if (!fragment)
            continue;

        const colonIndex = fragment.indexOf(':');
        if (colonIndex < 0)
            return null;

        const name = fragment.slice(0, colonIndex).trim().toLowerCase();
        if (name !== COLOR_PROPERTY && name !== BACKGROUND_COLOR_PROPERTY)
            return null;

        const value = fragment.slice(colonIndex + 1).trim().toLowerCase();
        if (!value)
            continue;

        if (name === COLOR_PROPERTY)
            result.color = value;
        else
            result.backgroundColor = value;
        matched = true;
    }

    return matched ? result : null;
}

export function isColorStyleEmpty(style: IColorStyle): boolean {
    return !style.color && !style.backgroundColor;
}

export function serializeColorStyle(style: IColorStyle): string {
    const parts: string[] = [];
    if (style.color)
        parts.push(`${COLOR_PROPERTY}:${style.color}`);
    if (style.backgroundColor)
        parts.push(`${BACKGROUND_COLOR_PROPERTY}:${style.backgroundColor}`);

    return parts.join(';');
}

export function colorSpanOpenTag(style: IColorStyle): string {
    return `<span style="${serializeColorStyle(style)}">`;
}
