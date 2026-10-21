// Absolute POSIX, UNC and drive paths must not be resolved against the document directory.
export const ABSOLUTE_LOCAL_REG = /^(?:\/|\\\\|[a-z]:\\|[a-z]:\/).+/i;

const IMAGE_EXT_REG = /\.(?:jpeg|jpg|png|gif|svg|webp)(?=\?|$)/i;

// At least two characters, so a Windows drive letter (`C:`) is not a scheme.
const URL_SCHEME_REG = /^[a-z][a-z\d+.-]+:/i;

// Resolve paths without Node APIs so the sandboxed renderer can use this helper.
export function resolveRelativePath(base: string, relative: string): string {
    const normalizedBase = base.replace(/\\/g, '/').replace(/\/+$/, '');
    const combined = `${normalizedBase}/${relative.replace(/\\/g, '/')}`;
    // Do not allow .. to escape a UNC share, Windows drive or POSIX root.
    const root = combined.match(/^\/\/[^/]+\/[^/]+/)?.[0]
        ?? combined.match(/^[a-z]:/i)?.[0]
        ?? '';
    const body = root ? combined.slice(root.length) : combined;
    const resolved: string[] = [];
    for (const segment of body.split('/')) {
        if (segment === '' || segment === '.')
            continue;

        if (segment === '..')
            resolved.pop();
        else
            resolved.push(segment);
    }
    const tail = resolved.join('/');
    if (root === '')
        return `/${tail}`;

    return tail ? `${root}/${tail}` : root;
}

// DIRNAME is raw filesystem text; Markdown paths are already encoded.
// Escape only the directory’s URL-significant characters.
export function encodeDirnameForUrl(dirname: string): string {
    return dirname
        .replace(/%/g, '%25')
        .replace(/\?/g, '%3F')
        .replace(/#/g, '%23');
}

export function localPathToFileUrl(src: string): string {
    const normalized = src.replace(/\\/g, '/');

    if (/^\/\/[^/]+\/[^/]+/.test(normalized))
        return `file://${normalized.slice(2)}`;

    if (/^[a-z]:\//i.test(normalized))
        return `file:///${normalized}`;

    return `file://${normalized}`;
}

// Resolve local exported image paths to absolute file URLs so exports retain images
// outside the source folder (#230, #678). Leave non-image and remote URLs unchanged.
export function resolveExportImageSrc(src: string): string {
    if (!src || URL_SCHEME_REG.test(src) || !IMAGE_EXT_REG.test(src))
        return src;

    // marked percent-encodes `\` in Markdown image destinations (#5714).
    const path = src.replace(/%5c/gi, '/');
    if (ABSOLUTE_LOCAL_REG.test(path))
        return localPathToFileUrl(path);

    const dirname = typeof window !== 'undefined' ? window.DIRNAME : undefined;
    if (!dirname)
        return src;

    return localPathToFileUrl(resolveRelativePath(encodeDirnameForUrl(dirname), path));
}
