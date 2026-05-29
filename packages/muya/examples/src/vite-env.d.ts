/// <reference types="vite/client" />

import type { Muya } from '@muyajs/core';

declare global {
    interface Window {
        // Debugging handle assigned by main.ts so the editor instance is
        // reachable from the browser devtools console.
        muya?: Muya;
    }

    // `Intl.Segmenter` (Stage 4, ES2022) is not in the ES2020 TS lib the
    // examples package targets. main.ts polyfills it on Firefox where the
    // runtime engine lacks support — both the feature-detect (`Intl.Segmenter`)
    // and the polyfill assignment need a real declaration.
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
