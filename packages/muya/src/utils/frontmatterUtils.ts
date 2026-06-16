import type { IFrontmatterPropertyState } from '../state/types';

function parseYaml(text: string): IFrontmatterPropertyState[] {
    const properties: IFrontmatterPropertyState[] = [];

    for (const line of text.split('\n')) {
        if (!line.trim() || line.trim().startsWith('#'))
            continue;

        const colonIdx = line.indexOf(':');
        if (colonIdx === -1)
            continue;

        const key = line.substring(0, colonIdx).trim();
        if (!key)
            continue;

        let value = line.substring(colonIdx + 1).trim();
        if (
            (value.startsWith('"') && value.endsWith('"'))
            || (value.startsWith('\'') && value.endsWith('\''))
        ) {
            value = value.slice(1, -1);
        }

        properties.push({ name: 'frontmatter.row', key, value });
    }

    return properties;
}

function serializeYaml(properties: IFrontmatterPropertyState[]): string {
    return properties
        .map(({ key, value }) => {
            if (!value)
                return `${key}:`;
            if (/[:#[\]{},&*?|>!%@`]/.test(value) || value.includes('\n'))
                return `${key}: "${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
            return `${key}: ${value}`;
        })
        .join('\n');
}

function parseToml(text: string): IFrontmatterPropertyState[] {
    const properties: IFrontmatterPropertyState[] = [];

    for (const line of text.split('\n')) {
        if (!line.trim() || line.trim().startsWith('#'))
            continue;

        const eqIdx = line.indexOf('=');
        if (eqIdx === -1)
            continue;

        const key = line.substring(0, eqIdx).trim();
        if (!key)
            continue;

        let value = line.substring(eqIdx + 1).trim();
        if (
            (value.startsWith('"') && value.endsWith('"'))
            || (value.startsWith('\'') && value.endsWith('\''))
        ) {
            value = value.slice(1, -1);
        }

        properties.push({ name: 'frontmatter.row', key, value });
    }

    return properties;
}

function serializeToml(properties: IFrontmatterPropertyState[]): string {
    return properties
        .map(({ key, value }) =>
            `${key} = "${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`,
        )
        .join('\n');
}

function parseJson(text: string): IFrontmatterPropertyState[] {
    try {
        // The JSON frontmatter body is the content between the delimiters
        // but may be missing the outer braces for `{}` style.
        const rawJson = text.trim().startsWith('{') ? text.trim() : `{${text}}`;
        const obj = JSON.parse(rawJson) as Record<string, unknown>;

        return Object.entries(obj).map(([key, value]) => ({
            name: 'frontmatter.row' as const,
            key,
            value: typeof value === 'string' ? value : JSON.stringify(value),
        }));
    }
    catch {
        return text
            .split('\n')
            .filter(l => l.trim())
            .map(line => ({ name: 'frontmatter.row' as const, key: line, value: '' }));
    }
}

function serializeJson(properties: IFrontmatterPropertyState[]): string {
    return properties
        .map(({ key, value }) => `"${key}": "${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`)
        .join(',\n');
}

export function parseProperties(text: string, lang: string): IFrontmatterPropertyState[] {
    const normalized = text.replace(/^\s+/, '').replace(/\s+$/, '');
    if (!normalized)
        return [];

    switch (lang) {
        case 'toml': return parseToml(normalized);
        case 'json': return parseJson(normalized);
        default: return parseYaml(normalized);
    }
}

export function serializeProperties(
    properties: IFrontmatterPropertyState[],
    lang: string,
): string {
    switch (lang) {
        case 'toml': return serializeToml(properties);
        case 'json': return serializeJson(properties);
        default: return serializeYaml(properties);
    }
}
