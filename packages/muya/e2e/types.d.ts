/// <reference types="vite/client" />

import type { IExportRenderOptions, IMuyaOptions, MarkdownToHtml, Muya } from '@muyajs/core';

declare global {
    // eslint-disable-next-line ts/naming-convention -- augmenting the global Window must keep its name
    interface Window {
        // Set by host/main.ts after muya.init() so Playwright page.evaluate()
        // callbacks can drive the editor through the public API.
        muya?: Muya;

        MarkdownToHtml?: typeof MarkdownToHtml;

        // Installed per-spec by `page.exposeFunction` when a test needs to
        // count DOM events the page fires on its own.
        __onCompositionStart?: () => void;

        // Installed by tests/typing/codeblock-node-identity.spec.ts, which tags the
        // nodes a block's DOM holds so a rebuild is visible as a fresh id
        // rather than as an equal-looking node.
        __nodeTrace?: () => {
            /** Distinct node ids that have ever been the element's first child. */
            firstChildIds: number[];
            /** childList mutations observed on the element. */
            rebuilds: number;
        };

        // Test-only globals exposed by host/main.ts. Aggregated under a single
        // namespace so the real Window surface stays clean.
        __e2e?: {
            linkJumps: Array<{ href?: string }>;
            INITIAL_MARKDOWN: string;
            PICKED_IMAGE_URL: string;
            UPLOADED_IMAGE_URL: string;
            /** Overrides are merged with HOST_OPTIONS on each rebuild. */
            rebuildMuya: (options?: Partial<IMuyaOptions>) => void;
            renderDiagramForExport: (options: IExportRenderOptions) => Promise<void>;
        };

        // XSS canary used by tests/security/sanitize.spec.ts. If a malicious
        // payload survives sanitization and executes, it would set this flag —
        // the spec asserts it remains `undefined`.
        __pwned?: boolean;
    }

    // `Intl.Segmenter` (Stage 4, ES2022) isn't in the ES2020 lib host/ targets.
    // Mirrors the minimal shape from examples/src/vite-env.d.ts.
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
