import components from 'prismjs/components.js';
import getLoader from 'prismjs/dependencies';

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

        const statuses: ILangLoadStatus[] = [];
        // The user might have loaded languages via some other way or used `prism.js` which already includes some
        // We don't need to validate the ids because `getLoader` will ignore invalid ones
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

        // Load in dependency order: a component whose grammar `extend`s another
        // (e.g. `cpp` extends `c`) must be imported only AFTER its dependency has
        // registered. The `chainer`'s `series`/`parallel` are Prism's async hooks
        // (`Promise#then` / `Promise.all`); without it the loader fires the
        // dependent's import without awaiting the dependency, racing them — if the
        // dependent evaluates first, `Prism.languages.extend('c', …)` runs on
        // `undefined` and throws "Cannot set properties of undefined (setting
        // 'class-name')", which also left the load promise unresolved (a hang).
        await getLoader(components, langs, loaded).load(loadComponent, {
            series: (before: Promise<void>, after: () => Promise<void>) =>
                before.then(after),
            parallel: (values: Promise<void>[]) => Promise.all(values),
        });

        return statuses;
    };
}

export default initLoadLanguage;
