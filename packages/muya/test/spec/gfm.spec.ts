// @vitest-environment happy-dom
/* eslint-disable test/prefer-lowercase-title */
// The describe / it titles use proper nouns ("CommonMark", "GFM") and the
// per-example title carries a section heading from the upstream spec — both
// must stay verbatim so test reports line up with spec line items.

import type { ISpecExample } from './runner';
import { describe, expect, it } from 'vitest';
import { renderToStaticHTML } from '../../src/state/renderToStaticHTML';
import gfmExamples from './fixtures/gfm-spec-0.29-gfm.json';
import {
    compareHtml,
    formatFailureMessage,
    getExpectedFailures,
} from './runner';

const examples: ISpecExample[] = gfmExamples as ISpecExample[];
const expectedFailures = getExpectedFailures('gfm');

describe('GFM 0.29-gfm spec conformance', () => {
    it.each(examples)(
        `GFM 0.29 §$section #$number`,
        (example) => {
            const actual = renderToStaticHTML(example.markdown, {
                footnote: false,
                math: false,
                superSubScript: false,
                isGitlabCompatibilityEnabled: false,
                frontMatter: false,
                // Bypass DOMPurify — see commonmark.spec.ts for rationale.
                sanitize: false,
            });
            const result = compareHtml(actual, example.html);
            const isExpectedFailure = expectedFailures.has(example.number);

            if (isExpectedFailure) {
                expect(
                    result.passed,
                    `GFM #${example.number} is on expected-failures but now PASSES. Remove it from test/spec/expected-failures.json.`,
                ).toBe(false);
            }
            else {
                expect(
                    result.passed,
                    formatFailureMessage(example, result),
                ).toBe(true);
            }
        },
    );
});
