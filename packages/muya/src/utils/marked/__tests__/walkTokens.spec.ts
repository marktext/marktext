import { describe, expect, it } from 'vitest';
import { lexBlock } from '../lexBlock';

describe('muya token augmentation', () => {
    it('applies muya token augmentation to nested tokens', () => {
        const tokens = lexBlock(
            '> # quoted heading\n\n- item\n\n  ```js\n  x\n  ```\n',
            {
                footnote: false,
                frontMatter: false,
                texMathDollars: false,
            },
        );
        const json = JSON.stringify(tokens);
        // Both augmentations live on tokens that are only reachable through
        // child arrays (blockquote > heading, list item > fenced code); a
        // walker that misses child arrays would leave them untouched.
        expect(json).toContain('"headingStyle":"atx"');
        expect(json).toContain('"codeBlockStyle":"fenced"');
    });
});
