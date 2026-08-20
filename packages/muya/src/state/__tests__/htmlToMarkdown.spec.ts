// @vitest-environment jsdom

import { describe, expect, it } from 'vitest';
import HtmlToMarkdown from '../htmlToMarkdown';

function convert(html: string): string {
    return new HtmlToMarkdown().generate(html);
}

describe('htmlToMarkdown — Google Docs style inline formatting', () => {
    it('preserves CSS bold and italic ranges from Google Docs without bolding the wrapper', () => {
        const html = [
            '<b style="font-weight:normal" id="docs-internal-guid-abc">',
            '<p dir="ltr">',
            '<span style="font-weight:700">Bold</span>',
            '<span> normal </span>',
            '<span style="font-style:italic">italic</span>',
            '</p>',
            '</b>',
        ].join('');

        expect(convert(html)).toBe('**Bold** normal *italic*');
    });

    it('does not treat a non-bold Google Docs wrapper as strong across paragraphs', () => {
        const html = [
            '<b style="font-weight:normal" id="docs-internal-guid-abc">',
            '<p>First para.</p>',
            '<p><span style="font-weight:700">Second bold para.</span></p>',
            '</b>',
        ].join('');

        expect(convert(html)).toBe('First para.\n\n**Second bold para.**');
    });

    it('preserves CSS formatting inside headings and list items', () => {
        expect(
            convert([
                '<h1><span>Heading </span><span style="font-weight:700">Bold</span></h1>',
                '<ul>',
                '<li><span>bullet </span><span style="font-weight:700">bold</span></li>',
                '<li><span>bullet </span><span style="font-style:italic">italic</span></li>',
                '</ul>',
            ].join('')),
        ).toBe('# Heading **Bold**\n\n- bullet **bold**\n- bullet *italic*');
    });

    it('preserves CSS formatting inside links', () => {
        expect(
            convert([
                '<p>',
                'Plain <a href="https://example.com/plain"><span>link</span></a>',
                ' and <a href="https://example.com/bold">',
                '<span style="font-weight:700">boldlink</span>',
                '</a>',
                '</p>',
            ].join('')),
        ).toBe('Plain [link](https://example.com/plain) and [**boldlink**](https://example.com/bold)');
    });

    it('recognizes common CSS strong weights without treating medium weights as bold', () => {
        expect(
            convert([
                '<p>',
                '<span style="font-weight:bold">Bold keyword</span>',
                '<span> </span>',
                '<span style="font-weight:600">Bold numeric</span>',
                '<span> </span>',
                '<span style="font-weight:500">Medium</span>',
                '</p>',
            ].join('')),
        ).toBe('**Bold keyword** **Bold numeric** Medium');
    });

    it('combines CSS bold and italic when both styles are on the same span', () => {
        expect(
            convert('<p><span style="font-weight:700;font-style:italic">Bold italic</span></p>'),
        ).toBe('***Bold italic***');
    });

    it('lets explicit normal CSS override semantic bold and italic wrappers', () => {
        expect(
            convert([
                '<p>',
                '<b style="font-weight:normal">Not bold</b>',
                '<span> </span>',
                '<i style="font-style:normal">Not italic</i>',
                '</p>',
            ].join('')),
        ).toBe('Not bold Not italic');
    });

    it('does not duplicate formatting when CSS spans are already inside semantic tags', () => {
        expect(
            convert([
                '<p>',
                '<strong><span style="font-weight:700">bold</span></strong>',
                ' ',
                '<em><span style="font-style:italic">italic</span></em>',
                ' ',
                '<strong><span style="font-style:italic">bold italic</span></strong>',
                '</p>',
            ].join('')),
        ).toBe('**bold** *italic* ***bold italic***');
    });

    it('still applies CSS spans inside semantic tags disabled by normal CSS', () => {
        expect(
            convert([
                '<p>',
                '<b style="font-weight:normal">',
                '<span style="font-weight:700">Bold</span>',
                '</b>',
                ' ',
                '<i style="font-style:normal">',
                '<span style="font-style:italic">italic</span>',
                '</i>',
                '</p>',
            ].join('')),
        ).toBe('**Bold** *italic*');
    });

    it('does not duplicate formatting through disabled semantic wrappers inside active ancestors', () => {
        expect(
            convert('<p><strong><b style="font-weight:normal"><span style="font-weight:700">Bold</span></b></strong></p>'),
        ).toBe('**Bold**');

        expect(
            convert('<p><em><i style="font-style:normal"><span style="font-style:italic">italic</span></i></em></p>'),
        ).toBe('*italic*');
    });

    it('keeps normal semantic strong and emphasis HTML unchanged', () => {
        expect(
            convert('<p>Plain <strong>boldword</strong> and <em>italicword</em> end.</p>'),
        ).toBe('Plain **boldword** and *italicword* end.');
    });
});
