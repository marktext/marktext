import components from 'prismjs/components.js';
import getLoader from 'prismjs/dependencies';
import { getDefer } from '../index';

interface ILangLoadStatus {
    lang: string;
    status: 'noexist' | 'cached' | 'loaded';
}
/**
 * The set of all languages which have been loaded using the below function.
 *
 * @type {Set<string>}
 */
export const loadedLanguages = new Set([
    'markup',
    'css',
    'clike',
    'javascript',
]);

const { languages } = components;

// Look for the origin language by alias
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
                // The lang is not exist, the will handle in `initLoadLanguage`
                result.push(lang);
            }
        }
    }

    return result;
}

// Minimal Prism surface this module needs — full Prism typings live in
// prismjs's external @types package, but we only read `languages` here.
interface IPrismLike {
    languages: Record<string, unknown>;
}

function initLoadLanguage(Prism: IPrismLike) {
    return async function loadLanguages(langs?: string[] | string) {
    // If no argument is passed, load all components
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

        const promises: Promise<ILangLoadStatus>[] = [];
        // The user might have loaded languages via some other way or used `prism.js` which already includes some
        // We don't need to validate the ids because `getLoader` will ignore invalid ones
        const loaded = [...loadedLanguages, ...Object.keys(Prism.languages)];
        getLoader(components, langs, loaded).load(async (lang: string) => {
            const defer = getDefer<ILangLoadStatus>();
            promises.push(defer.promise);
            if (!(lang in components.languages)) {
                defer.resolve({
                    lang,
                    status: 'noexist',
                });
            }
            else if (loadedLanguages.has(lang)) {
                defer.resolve({
                    lang,
                    status: 'cached',
                });
            }
            else {
                delete Prism.languages[lang];
                await import(
                    `../../../node_modules/prismjs/components/prism-${lang}.js`,
                );
                defer.resolve({
                    lang,
                    status: 'loaded',
                });
                loadedLanguages.add(lang);
            }
        });

        return Promise.all(promises);
    };
}

export default initLoadLanguage;
