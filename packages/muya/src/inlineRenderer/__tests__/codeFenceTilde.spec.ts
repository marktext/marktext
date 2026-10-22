// @vitest-environment happy-dom

import type { BeginRuleToken } from '../types';
import { describe, expect, it } from 'vitest';
import { tokenizer } from '../lexer';

// CommonMark §4.5: an opening code fence is a run of at least three backticks
// or tildes; a backtick fence's info string may not contain a backtick, while a
// tilde fence's may contain either character. The inline renderer greys the
// marker and shows the info string as the language, so the begin rule has to
// split both fence kinds the same way.
function fenceToken(src: string): BeginRuleToken | undefined {
    return tokenizer(src).find(
        (token): token is BeginRuleToken => token.type === 'code_fence',
    );
}

describe('inline code_fence rule — tilde fences', () => {
    it('tokenizes a backtick fence into marker + info string', () => {
        const token = fenceToken('```js');
        expect(token?.marker).toBe('```');
        expect(token?.content).toBe('js');
    });

    it('tokenizes a tilde fence into marker + info string', () => {
        const token = fenceToken('~~~js');
        expect(token?.marker).toBe('~~~');
        expect(token?.content).toBe('js');
    });

    it('accepts backticks inside a tilde info string', () => {
        const token = fenceToken('~~~aa ``` ~~~');
        expect(token?.marker).toBe('~~~');
        expect(token?.content).toBe('aa ``` ~~~');
    });

    it('rejects a backtick fence whose info string contains a backtick', () => {
        expect(fenceToken('```a`b')).toBeUndefined();
    });
});
