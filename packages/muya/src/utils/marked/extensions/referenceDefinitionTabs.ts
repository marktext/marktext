import type { MarkedExtension } from 'marked';
import { Tokenizer } from 'marked';

export default function referenceDefinitionTabs(): MarkedExtension {
    return {
        tokenizer: {
            def(src) {
                if (!/^ {0,3}\[/.test(src))
                    return false;

                // Marked 18.1.3 accepts only spaces at definition separators (#5968).
                // Keep its grammar and validation without rewriting tabs in titles or raw source.
                const { rules } = this;
                const tokenizer = new Tokenizer(this.options);
                tokenizer.rules = {
                    ...rules,
                    block: {
                        ...rules.block,
                        def: new RegExp(rules.block.def.source.replace(/ (?=[*+])/g, '[ \\t]'), rules.block.def.flags),
                    },
                };
                return tokenizer.def(src) ?? false;
            },
        },
    };
}
