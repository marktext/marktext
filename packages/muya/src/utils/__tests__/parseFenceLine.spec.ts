import { describe, expect, it } from 'vitest';
import { parseFenceLine } from '../index';

describe('parseFenceLine', () => {
    it('parses a backtick fence with info', () => {
        expect(parseFenceLine('```js')).toEqual({
            fenceChar: '`',
            fenceLength: 3,
            info: 'js',
        });
    });

    it('parses a tilde fence with info', () => {
        expect(parseFenceLine('~~~ js')).toEqual({
            fenceChar: '~',
            fenceLength: 3,
            info: ' js',
        });
    });

    it('parses longer runs and up to three leading spaces (CommonMark §4.5)', () => {
        expect(parseFenceLine('   ~~~~~py title="x"')).toEqual({
            fenceChar: '~',
            fenceLength: 5,
            info: 'py title="x"',
        });
    });

    it('stops at the end of the opening line', () => {
        expect(parseFenceLine('```js\ncode\n```')).toEqual({
            fenceChar: '`',
            fenceLength: 3,
            info: 'js',
        });
    });

    it('returns an empty info string for a bare fence', () => {
        expect(parseFenceLine('~~~')).toEqual({
            fenceChar: '~',
            fenceLength: 3,
            info: '',
        });
    });

    it('rejects a backtick fence whose info contains a backtick', () => {
        expect(parseFenceLine('```a `b`')).toBeNull();
    });

    it('accepts a tilde fence whose info contains a backtick', () => {
        expect(parseFenceLine('~~~a `b`')).toEqual({
            fenceChar: '~',
            fenceLength: 3,
            info: 'a `b`',
        });
    });

    it('accepts a tilde fence whose info starts with a tilde', () => {
        expect(parseFenceLine('~~~ ~foo')).toEqual({
            fenceChar: '~',
            fenceLength: 3,
            info: ' ~foo',
        });
    });

    it('rejects non-fence lines', () => {
        expect(parseFenceLine('``js')).toBeNull();
        expect(parseFenceLine('~~')).toBeNull();
        expect(parseFenceLine('    ```js')).toBeNull();
        expect(parseFenceLine('text ```js')).toBeNull();
        expect(parseFenceLine('```js`')).toBeNull();
        expect(parseFenceLine('')).toBeNull();
    });
});
