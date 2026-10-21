import Fuse from 'fuse.js';
import Prism from 'prismjs';
import { languages } from 'prismjs/components.js';
import initLoadLanguage, { loadedLanguages, transformAliasToOrigin } from './loadLanguage';

const prism = Prism;
window.Prism = Prism;
import('prismjs/plugins/keep-markup/prism-keep-markup');

// Prism omits c++/h++ aliases; register them once on the shared language table (#2910).
if (languages.cpp) {
    const existing = languages.cpp.alias;
    const alias = Array.isArray(existing) ? [...existing] : existing ? [existing] : [];
    for (const name of ['c++', 'h++']) {
        if (!alias.includes(name))
            alias.push(name);
    }
    languages.cpp.alias = alias;
}

const langs: {
    name: string;
    [key: string]: string;
}[] = [];

for (const name of Object.keys(languages)) {
    const lang = languages[name];
    langs.push({
        name,
        ...lang,
    });
    if (lang.alias) {
        if (typeof lang.alias === 'string') {
            langs.push({
                name: lang.alias,
                ...lang,
            });
        }
        else if (Array.isArray(lang.alias)) {
            langs.push(
                ...lang.alias.map((a: string) => ({
                    name: a,
                    ...lang,
                })),
            );
        }
    }
}

const loadLanguage = initLoadLanguage(Prism);

function search(text: string) {
    if (!text || typeof text !== 'string')
        return [];

    const fuse = new Fuse(langs, {
        includeScore: true,
        keys: ['name', 'title', 'alias'],
    });

    return fuse.search(text).map(i => i.item).slice(0, 5);
}

// Prism’s LaTeX comment rule must not swallow an escaped percent sign.
export function patchLatexEscapedPercent(prismInstance: typeof Prism) {
    const latex = prismInstance.languages.latex as { comment?: unknown } | undefined;
    if (latex?.comment)
        latex.comment = { pattern: /(^|[^\\])%.*/, lookbehind: true };
}

loadLanguage('latex').then(() => patchLatexEscapedPercent(prism));
loadLanguage('yaml');

export { walkTokens } from './walkToken';
export { loadedLanguages, loadLanguage, search, transformAliasToOrigin };
export default prism;
