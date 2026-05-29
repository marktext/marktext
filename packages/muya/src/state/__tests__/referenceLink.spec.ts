import type { TContainerState, TState } from '../types';
import { describe, expect, it } from 'vitest';
import { tokenizer } from '../../inlineRenderer/lexer';
import { beginRules } from '../../inlineRenderer/rules';
import { MarkdownToState } from '../markdownToState';
import ExportMarkdown from '../stateToMarkdown';

// Mirrors `InlineRenderer.collectReferenceDefinitions` so the spec can verify
// the full markdown → state → label-collection → inline tokenize pipeline
// without spinning up a real Muya instance.
function collectLabels(states: TState[]) {
    const labels = new Map<string, { href: string; title: string }>();

    const visit = (sts: TState[]) => {
        for (const st of sts) {
            if (st.name === 'paragraph') {
                const tokens = beginRules.reference_definition.exec(st.text);
                if (tokens) {
                    const label = (tokens[2] + tokens[3]).toLowerCase();
                    if (!labels.has(label)) {
                        labels.set(label, {
                            href: tokens[6],
                            title: tokens[10] || '',
                        });
                    }
                }
            }
            else if ((st as TContainerState).children) {
                visit((st as TContainerState).children);
            }
        }
    };

    visit(states);
    return labels;
}

function parse(md: string) {
    const states = new MarkdownToState({
        footnote: false,
        math: false,
        isGitlabCompatibilityEnabled: false,
        trimUnnecessaryCodeBlockEmptyLines: false,
        frontMatter: false,
    }).generate(md);
    const labels = collectLabels(states);
    return { states, labels };
}

function tokenize(text: string, labels: Map<string, { href: string; title: string }>) {
    return tokenizer(text, {
        labels,
        hasBeginRules: false,
        options: { superSubScript: true, footnote: false },
    });
}

describe('reference link / image — markdown ↔ state round-trip', () => {
    it('case 1 — loading markdown with [label]: url keeps the definition as a paragraph state', () => {
        const md = `foo [bar][1]\n\n[1]: https://example.com "title"\n`;
        const { states } = parse(md);

        const paragraphs = states.filter(s => s.name === 'paragraph') as Array<{ name: 'paragraph'; text: string }>;
        const defParagraph = paragraphs.find(p => /^\s*\[1\]:/.test(p.text));
        expect(defParagraph, 'reference definition should be preserved as a paragraph').toBeDefined();
        expect(defParagraph!.text).toContain('[1]: https://example.com');
        expect(defParagraph!.text).toContain('"title"');
    });

    it('case 2 — round-trip: getMarkdown output contains the reference definition line', () => {
        const md = `foo [bar][1]\n\n[1]: https://example.com "title"\n`;
        const { states } = parse(md);
        const out = new ExportMarkdown().generate(states);
        expect(out).toMatch(/\[1\]:\s*https:\/\/example\.com/);
        expect(out).toContain('"title"');
    });

    it('case 3 — inline tokenize: reference_link resolves to a token whose label maps to href', () => {
        const md = `foo [bar][1]\n\n[1]: https://example.com\n`;
        const { states, labels } = parse(md);

        expect(labels.get('1')?.href).toBe('https://example.com');

        const para = (states as Array<{ name: string; text?: string }>).find(s => s.name === 'paragraph' && s.text!.startsWith('foo')) as { text: string };
        const tokens = tokenize(para.text, labels);
        const refTok = tokens.find(t => t.type === 'reference_link');
        expect(refTok, 'reference_link token should be emitted once labels are known').toBeDefined();
        expect((refTok as Extract<typeof tokens[number], { type: 'reference_link' }>).label).toBe('1');
    });

    it('case 4 — inline tokenize: Full / Collapsed / Shortcut forms all produce reference_link tokens', () => {
        const md = `A [full][1] and [collapsed][] and [shortcut] here.\n\n[1]: https://a.example\n[collapsed]: https://b.example\n[shortcut]: https://c.example\n`;
        const { states, labels } = parse(md);

        const para = (states as Array<{ name: string; text?: string }>).find(s => s.name === 'paragraph' && s.text!.startsWith('A ')) as { text: string };
        const tokens = tokenize(para.text, labels);
        const refToks = tokens.filter(t => t.type === 'reference_link') as Extract<typeof tokens[number], { type: 'reference_link' }>[];
        expect(refToks.length).toBe(3);
        expect(refToks[0].isFullLink).toBe(true);
        expect(refToks[1].isFullLink).toBe(false);
        expect(refToks[2].isFullLink).toBe(false);
    });

    it('case 5 — definition with title: title propagates through label lookup', () => {
        const md = `foo [bar][ref]\n\n[ref]: https://example.com "Ref Title"\n`;
        const { labels } = parse(md);

        const info = labels.get('ref');
        expect(info?.href).toBe('https://example.com');
        expect(info?.title).toBe('Ref Title');
    });

    it('case 6 — label matching is case-insensitive', () => {
        const md = `foo [bar][REF]\n\n[ref]: https://example.com\n`;
        const { states, labels } = parse(md);

        expect(labels.get('ref')?.href).toBe('https://example.com');

        const para = (states as Array<{ name: string; text?: string }>).find(s => s.name === 'paragraph' && s.text!.startsWith('foo')) as { text: string };
        const tokens = tokenize(para.text, labels);
        const refTok = tokens.find(t => t.type === 'reference_link');
        expect(refTok, 'reference_link must match label irrespective of case').toBeDefined();
    });

    it('case 7 — duplicate label: first definition wins', () => {
        const md = `foo [bar][dup]\n\n[dup]: https://first.example\n[dup]: https://second.example\n`;
        const { labels } = parse(md);

        expect(labels.get('dup')?.href).toBe('https://first.example');
    });

    it('case 8 — orphan reference_link with no matching definition stays as plain text', () => {
        const md = `Look at [missing][nope] please.\n`;
        const { states, labels } = parse(md);

        expect(labels.size).toBe(0);

        const para = (states as Array<{ name: string; text?: string }>).find(s => s.name === 'paragraph') as { text: string };
        const tokens = tokenize(para.text, labels);
        const refTok = tokens.find(t => t.type === 'reference_link');
        expect(refTok, 'no reference_link token should fire without a matching definition').toBeUndefined();
        const raw = tokens.map(t => t.raw).join('');
        expect(raw).toContain('[missing][nope]');
    });
});
