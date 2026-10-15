// A local image path that is already anchored to a filesystem root:
// POSIX (`/foo`), Windows UNC (`\\host\share`), or a drive letter
// (`C:\foo` / `C:/foo`), so absolute paths are NOT resolved against the
// document directory.
export const ABSOLUTE_LOCAL_REG = /^(?:\/|\\\\|[a-z]:\\|[a-z]:\/).+/i;

const IMAGE_EXT_REG = /\.(?:jpeg|jpg|png|gif|svg|webp)(?=\?|$)/i;

// At least two characters, so a Windows drive letter (`C:`) is not a scheme.
const URL_SCHEME_REG = /^[a-z][a-z\d+.-]+:/i;

/**
 * Resolve a relative POSIX path against an absolute base directory, mirroring
 * Node's `path.resolve(base, rel)` for the cases `getImageSrc` cares about.
 * Kept self-contained so the engine does not depend on the desktop host's
 * `window.path` polyfill. Windows-style backslashes in `base` are normalised
 * to `/` first (Chromium loads `file://` URLs with forward slashes regardless
 * of platform). `.` and `..` segments are collapsed.
 */
export function resolveRelativePath(base: string, relative: string): string {
    const normalizedBase = base.replace(/\\/g, '/').replace(/\/+$/, '');
    const combined = `${normalizedBase}/${relative.replace(/\\/g, '/')}`;
    // Isolate the root that `..` must never collapse past (mirroring
    // `path.resolve`): a UNC share (`//server/share`), a Windows drive (`C:`),
    // or the POSIX root. The root prefix is preserved; `..` beyond it is a no-op.
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
    // POSIX root keeps a leading slash; a drive/UNC root prefixes its tail.
    if (root === '')
        return `/${tail}`;

    return tail ? `${root}/${tail}` : root;
}

// `window.DIRNAME` is a raw filesystem path, whereas a markdown image path is
// already URL-encoded, so only the directory gets its `%`, `?` and `#` escaped:
// raw, they would read as an escape, a query or a fragment (#5212).
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

/**
 * Resolve an exported `<img>` src to an absolute `file://` URL, so a saved
 * HTML / PDF document still finds its images after it leaves the source folder
 * (issue 230, GH#678). Local paths with a recognised image extension are
 * resolved: absolute POSIX / UNC / Windows drive paths directly, relative ones
 * against `window.DIRNAME`. Anything with a URL scheme is left for the
 * sanitizer to judge, and extensionless paths such as `/api/image?id=1` or
 * relative paths with no document directory are returned unchanged.
 */
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
