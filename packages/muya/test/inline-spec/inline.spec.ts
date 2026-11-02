import type { IBaselineEntry } from './audit';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';
import { audit, baselineEntry, summarize } from './audit';
import baseline from './baseline.json';
import { examples } from './fixtures';

const directory = path.dirname(fileURLToPath(import.meta.url));
const reportDirectory = path.resolve(directory, '../../test-results/inline-spec');
const update = process.env.UPDATE_INLINE_SPEC_BASELINE === '1';
const results = examples.map(audit);
const entries = baseline.entries as Record<string, IBaselineEntry>;

if (update) {
    const updated = Object.fromEntries(results.flatMap((result) => {
        const entry = baselineEntry(result);
        return entry ? [[result.id, entry]] : [];
    }));
    fs.writeFileSync(path.join(directory, 'baseline.json'), `${JSON.stringify({ ...baseline, entries: updated }, null, 4)}\n`);
}

afterAll(() => {
    const report = {
        versions: { commonmark: baseline.commonmarkVersion, gfm: baseline.gfmVersion },
        profile: 'Live lexer with optional MarkText extensions disabled; always-enabled GFM/emoji behavior is reported separately.',
        scope: 'Official inline sections, including escapes/entities. Unsupported block shapes are uncovered, never passes. No rendering/interaction conformance is implied.',
        rawHtml: {
            examplesWithFieldDifferences: results.filter(result => result.htmlFields.length > 0).length,
            examplesWithAttributePolicies: results.filter(result => result.htmlAttributePolicies.length > 0).length,
            scope: 'Parsed tags and retained attributes are checked independently of raw HTML syntax. Whitelist exclusions, dimension normalization and empty image defaults are recorded in htmlAttributePolicies, not as spec defects.',
        },
        summary: summarize(results),
        results: results.map(result => ({
            ...result,
            reason: entries[result.id]?.status === result.status ? entries[result.id].reason : result.reason,
            baseline: entries[result.id],
        })),
    };
    fs.mkdirSync(reportDirectory, { recursive: true });
    fs.writeFileSync(path.join(reportDirectory, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
    process.stdout.write(`${report.summary.map(row => `${row.suite} / ${row.section}: ${row.conforming}/${row.total} conforming, ${row['known-difference']} differences, ${row['extension-difference']} extensions, ${row['version-difference']} versions, ${row.uncovered} uncovered`).join('\n')}\nReport: ${path.join(reportDirectory, 'report.json')}\n`);
});

describe('live inline lexer / official CommonMark and GFM examples', () => {
    it('has no duplicate cases or orphaned baseline entries', () => {
        const ids = new Set(examples.map(example => example.id));
        expect(ids.size).toBe(examples.length);
        expect(Object.keys(entries).filter(id => !ids.has(id))).toEqual([]);
        for (const entry of Object.values(entries)) {
            expect(['known-difference', 'extension-difference', 'version-difference', 'uncovered']).toContain(entry.status);
            expect(entry.reason.trim()).not.toBe('');
            if (entry.status !== 'uncovered')
                expect(entry.fingerprint).toMatch(/^[a-f0-9]{64}$/);
        }
    });

    it.each(results)('$id §$section [$status]', (result) => {
        expect(result.invariants, `${result.id}: source/range invariants\n${JSON.stringify(result.markdown)}`).toEqual([]);
        if (update)
            return;

        const expectedEntry = entries[result.id];
        const actualEntry = baselineEntry(result);
        const diagnostic = [
            result.id,
            JSON.stringify(result.markdown),
            `expected: ${JSON.stringify(result.expected)}`,
            `actual: ${JSON.stringify(result.actual)}`,
            `raw HTML parsed-field differences: ${JSON.stringify(result.htmlFields)}`,
            'A repaired case must leave the baseline. New/changed differences require review; consult test-results/inline-spec/report.json.',
        ].join('\n');
        if (expectedEntry)
            expect(expectedEntry.reason.trim()).not.toBe('');
        expect(actualEntry && { status: actualEntry.status, fingerprint: actualEntry.fingerprint }, diagnostic)
            .toEqual(expectedEntry && { status: expectedEntry.status, fingerprint: expectedEntry.fingerprint });
    });
});
