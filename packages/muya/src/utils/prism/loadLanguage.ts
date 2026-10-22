import components from 'prismjs/components.js';
import getLoader from 'prismjs/dependencies';

export interface ILangLoadStatus {
    lang: string;
    status: 'noexist' | 'cached' | 'loaded';
}
export const loadedLanguages = new Set([
    'markup',
    'css',
    'clike',
    'javascript',
]);

const { languages } = components;

export function transformAliasToOrigin(langs: string[]) {
    const result = [];

    for (const lang of langs) {
        if (languages[lang]) {
            result.push(lang);
        }
        else {
            const language = Object.keys(languages).find((name) => {
                const l = languages[name];
                if (l.alias) {
                    return (
                        l.alias === lang
                        || (Array.isArray(l.alias) && l.alias.includes(lang))
                    );
                }

                return false;
            });

            if (language) {
                result.push(language);
            }
            else {
                result.push(lang);
            }
        }
    }

    return result;
}

interface IPrismLike {
    languages: Record<string, unknown>;
}

function initLoadLanguage(Prism: IPrismLike) {
    return async function loadLanguages(langs?: string[] | string) {
        if (!langs)
            langs = Object.keys(languages).filter(lang => lang !== 'meta');

        if (langs && !langs.length) {
            return Promise.reject(
                new Error(
                    'The first parameter should be a list of load languages or single language.',
                ),
            );
        }

        if (!Array.isArray(langs))
            langs = [langs];

        const statuses: ILangLoadStatus[] = [];
        // Include grammars loaded externally; getLoader ignores unknown IDs.
        const loaded = [...loadedLanguages, ...Object.keys(Prism.languages)];

        const loadComponent = async (lang: string): Promise<void> => {
            if (!(lang in components.languages)) {
                statuses.push({ lang, status: 'noexist' });
                return;
            }
            if (loadedLanguages.has(lang)) {
                statuses.push({ lang, status: 'cached' });
                return;
            }
            delete Prism.languages[lang];
            await import(
                `../../../node_modules/prismjs/components/prism-${lang}.js`,
            );
            loadedLanguages.add(lang);
            statuses.push({ lang, status: 'loaded' });
        };

        // Load dependencies before their dependents: cpp extends c and cannot register first.
        await getLoader(components, langs, loaded).load(loadComponent, {
            series: (before: Promise<void>, after: () => Promise<void>) =>
                before.then(after),
            parallel: (values: Promise<void>[]) => Promise.all(values),
        });

        return statuses;
    };
}

export default initLoadLanguage;
