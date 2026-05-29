import type Content from '../block/base/content';
import type Parent from '../block/base/parent';

declare global {
    interface Window {
        Prism: unknown;
        MUYA_VERSION: string;
    }

    interface Element {
        __MUYA_BLOCK__: Content | Parent;
    }

    // `Intl.Segmenter` (Stage 4, ES2022) is not in the ES2020 TS lib the
    // package targets. Declare the minimal surface we use so `visibleLength`
    // can call it without an `as any` escape hatch. The examples app
    // polyfills it when the runtime engine lacks support.
    namespace Intl {
        interface ISegmenterOptions {
            granularity?: 'grapheme' | 'word' | 'sentence';
        }
        interface ISegmentData {
            segment: string;
            index: number;
            input: string;
        }
        class Segmenter {
            constructor(locales?: string | string[], options?: ISegmenterOptions);
            segment(input: string): Iterable<ISegmentData>;
        }
    }
}
