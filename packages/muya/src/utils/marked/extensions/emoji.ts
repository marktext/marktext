import { validEmoji } from '../../../utils/emoji';

const START_REG = /(\s|^):(?!:)/;
const EMOJI_REG = /^(:)([a-z_\d+-]+)\1/;

interface IEmojiToken {
    type: string;
    raw: string;
    text: string;
    marker: string;
}

interface IOptions {
    isRenderEmoji?: boolean;
};

const DEFAULT_OPTIONS = {
    isRenderEmoji: true,
};

export default function (options: IOptions = {}) {
    const opts = Object.assign({}, DEFAULT_OPTIONS, options);

    return {
        extensions: [getExtension(opts)],
    };
}

function getExtension(opts: IOptions) {
    return {
        name: 'emoji',
        level: 'inline' as const,
        start(src: string) {
            const match = src.match(START_REG);
            if (!match)
                return;

            const index = (match.index || 0) + match[1].length;
            const possibleEmoji = src.substring(index);

            if (EMOJI_REG.test(possibleEmoji))
                return index;
        },

        tokenizer(src: string) {
            const match = src.match(EMOJI_REG);

            if (match) {
                return {
                    type: 'emoji',
                    raw: match[0],
                    text: match[2].trim(),
                    marker: match[1],
                };
            }
        },

        renderer(token: IEmojiToken) {
            const { isRenderEmoji } = opts;
            const { text, marker } = token;
            if (isRenderEmoji) {
                const validate = validEmoji(text);
                if (validate)
                    return validate.emoji;
                else
                    return `${marker}${text}${marker}`;
            }
            else {
                return `${marker}${text}${marker}`;
            }
        },
    };
}
