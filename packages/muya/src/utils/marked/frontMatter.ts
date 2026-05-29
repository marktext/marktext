const FRONT_REG
    = /^(?:---\n([\s\S]+?)---|\+\+\+\n([\s\S]+?)\+\+\+|;;;\n([\s\S]+?);;;|\{\n([\s\S]+?)\})(?:\n{2,}|\n{1,2}$)/;

const STYLE_LANG = {
    '-': 'yaml',
    '+': 'toml',
    ';': 'json',
    '{': 'json',
} as const;

interface IFrontMatterToken {
    type: 'frontmatter';
    raw: string;
    text: string;
    style: keyof typeof STYLE_LANG;
    lang: 'yaml' | 'toml' | 'json';
}

export default function getFrontMatterInfo(text: string) {
    const matches = FRONT_REG.exec(text);
    let token: IFrontMatterToken | null = null;
    let src = text;
    if (matches) {
        const raw = matches[0];
        const style = raw[0] as keyof typeof STYLE_LANG;
        const lang = STYLE_LANG[style];

        token = {
            type: 'frontmatter',
            raw,
            text: matches[1] ?? matches[2] ?? matches[3] ?? matches[4],
            style,
            lang,
        };

        src = text.substring(raw.length);
    }

    return { token, src };
}

export function frontMatterRender(token: IFrontMatterToken) {
    const { text, style, lang } = token;

    return `<pre class="front-matter" data-style="${style}" data-lang="${lang}">\n${text}</pre>\n`;
}
