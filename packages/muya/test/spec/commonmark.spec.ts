// @vitest-environment happy-dom
/* eslint-disable test/prefer-lowercase-title */
// The describe / it titles use proper nouns ("CommonMark", "GFM") and the
// per-example title carries a section heading from the upstream spec — both
// must stay verbatim so test reports line up with spec line items.

import type { ISpecExample } from './runner';
// @ts-expect-error commonmark-spec is plain CommonJS w/o types
import cms from 'commonmark-spec';
import { describe, expect, it } from 'vitest';
import { renderToStaticHTML } from '../../src/state/renderToStaticHTML';
import {
    compareHtml,
    formatFailureMessage,
    getExpectedFailures,
} from './runner';

const examples: ISpecExample[] = cms.tests as ISpecExample[];
const expectedFailures = getExpectedFailures('commonmark');

describe('CommonMark 0.31 spec conformance', () => {
    it.each(examples)(
        `CM 0.31 §$section #$number`,
        (example) => {
            const actual = renderToStaticHTML(example.markdown, {
                footnote: false,
                math: false,
                superSubScript: false,
                isGitlabCompatibilityEnabled: false,
                frontMatter: false,
                // Bypass DOMPurify: spec tests verify the *parser's* output
                // (§6.9 "Raw HTML" explicitly tests that unknown tags like
                // `<bab>` are preserved). DOMPurify is exercised separately
                // by the renderToStaticHTML unit tests.
                sanitize: false,
            });
            const result = compareHtml(actual, example.html);
            const isExpectedFailure = expectedFailures.has(example.number);

            if (isExpectedFailure) {
                // "Regression-lock": this example is on the expected-failures
                // list. If it now passes, the list is stale and the test
                // fails so the maintainer must remove it.
                expect(
                    result.passed,
                    `CommonMark #${example.number} is on expected-failures but now PASSES. Remove it from test/spec/expected-failures.json.`,
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
