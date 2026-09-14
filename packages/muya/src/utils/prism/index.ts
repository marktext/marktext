import Fuse from 'fuse.js';
import Prism from 'prismjs';
import { languages } from 'prismjs/components.js';
import initLoadLanguage, { loadedLanguages, transformAliasToOrigin } from './loadLanguage';

const prism = Prism;
window.Prism = Prism;
import('prismjs/plugins/keep-markup/prism-keep-markup');

// prismjs ships C++ without a `c++`/`h++` alias, so fenced blocks tagged
// ```c++ never resolve to the cpp grammar and stay unhighlighted (#2910).
// Add each alias only once — `components.languages` is a shared singleton and
// this module may be evaluated more than once (tests, HMR); pushing duplicates
// makes prism's dependency loader throw "c++ cannot be alias for both cpp and
// cpp".
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

// In LaTeX `\%` is an escaped literal percent, not a line comment, but
// prismjs's default latex `comment` token (`/%.*/`) swallows everything after
// it. Require the `%` to not follow a backslash so `\%` highlights as a normal
// control sequence (#3037). tex/context alias the same grammar object, so this
// one override covers all three.
export function patchLatexEscapedPercent(prismInstance: typeof Prism) {
    const latex = prismInstance.languages.latex as { comment?: unknown } | undefined;
    if (latex?.comment)
        latex.comment = { pattern: /(^|[^\\])%.*/, lookbehind: true };
}

// pre load latex and yaml and html for `math block` \ `front matter` and `html block`
loadLanguage('latex').then(() => patchLatexEscapedPercent(prism));
loadLanguage('yaml');

export { walkTokens } from './walkToken';
export { loadedLanguages, loadLanguage, search, transformAliasToOrigin };
export default prism;
