/* eslint-disable ts/no-unsafe-declaration-merging */
import type { VNode } from 'snabbdom';
import type Format from '../../block/base/format';
import type { Muya } from '../../index';
import type { IRenderCursor } from '../../selection/types';
import type InlineRenderer from '../index';
import type { ISyntaxRenderOptions, Token } from '../types';
import { CLASS_NAMES } from '../../config';
import { conflict, methodMixins, snakeToCamel } from '../../utils';
import { h, toHTML } from '../../utils/snabbdom';
import autoLink from './autoLink';
import autoLinkExtension from './autoLinkExtension';
import backlash from './backlash';
import backlashInToken from './backlashInToken';
import codeFence from './codeFence';
import del from './del';
import delEmStrongFac from './delEmStrongFactory';
import em from './em';
import emoji from './emoji';
import footnoteIdentifier from './footnoteIdentifier';
import hardLineBreak from './hardLineBreak';
import header from './header';
import highlight from './highlight';
import hr from './hr';
import htmlEscape from './htmlEscape';
import htmlRuby from './htmlRuby';
import htmlTag from './htmlTag';
import image from './image';
import inlineCode from './inlineCode';
import inlineMath from './inlineMath';
import link from './link';
import loadImageAsync from './loadImageAsync';
import multipleMath from './multipleMath';
import referenceDefinition from './referenceDefinition';
import referenceImage from './referenceImage';
import referenceLink from './referenceLink';
import softLineBreak from './softLineBreak';
import strong from './strong';
import superSubScript from './superSubScript';
import tailHeader from './tailHeader';
import text from './text';

const inlineSyntaxRenderer = {
    backlashInToken,
    backlash,
    highlight,
    header,
    link,
    htmlTag,
    hr,
    tailHeader,
    hardLineBreak,
    softLineBreak,
    codeFence,
    inlineMath,
    autoLink,
    autoLinkExtension,
    loadImageAsync,
    image,
    delEmStrongFac,
    emoji,
    inlineCode,
    text,
    del,
    em,
    strong,
    htmlEscape,
    multipleMath,
    referenceDefinition,
    htmlRuby,
    referenceLink,
    referenceImage,
    superSubScript,
    footnoteIdentifier,
};

type InlineSyntaxRender = typeof inlineSyntaxRenderer;

// Generic shape every per-token renderer matches; used by the dynamic
// dispatcher below (`Renderer.dispatch`) so it can call into the mixin map
// without an `as any` escape hatch.
export type TInlineRenderFn = (opts: ISyntaxRenderOptions) => VNode[];

// Declaration-merged with the class below to expose mixin method signatures;
// must share the class name, so the `I` prefix convention does not apply here.
// eslint-disable-next-line ts/naming-convention
interface Renderer extends InlineSyntaxRender {}

@methodMixins(inlineSyntaxRenderer)
class Renderer {
    public loadMathMap: Map<
        string,
    string | VNode | (string | VNode)[] | undefined
    > = new Map();

    public loadImageMap: Map<
        string,
        {
            id: string;
            isSuccess: boolean;
            url?: string;
            width?: number;
            height?: number;
        }
    > = new Map();

    public urlMap: Map<string, string> = new Map();

    constructor(public muya: Muya, public parent: InlineRenderer) {}

    checkConflicted(block: Format, token: Token, cursor: IRenderCursor = {}) {
        const anchor = cursor.anchor || cursor.start;
        const focus = cursor.focus || cursor.end;
        if (!anchor || !focus || (cursor.block && cursor.block !== block))
            return false;

        const { start, end } = token.range;

        return (
            conflict([start, end], [anchor.offset, anchor.offset])
            || conflict([start, end], [focus.offset, focus.offset])
        );
    }

    getClassName(
        outerClass: string | undefined,
        block: Format,
        token: Token,
        cursor: IRenderCursor,
    ) {
        return (
            outerClass
            || (this.checkConflicted(block, token, cursor)
                ? CLASS_NAMES.MU_GRAY
                : CLASS_NAMES.MU_HIDE)
        );
    }

    getHighlightClassName(active: boolean) {
        return active ? CLASS_NAMES.MU_HIGHLIGHT : CLASS_NAMES.MU_SELECTION;
    }

    // Dynamic dispatch helper: each per-token renderer in `inlineSyntaxRenderer`
    // shares the `(opts: ISyntaxRenderOptions) => VNode[]` signature. Method
    // names follow `snakeToCamel(token.type)` (e.g. `reference_link` →
    // `referenceLink`). The runtime guarantee is that
    // `inlineSyntaxRenderer[name]` exists for every token type the lexer can
    // emit — declaration-merging `Renderer extends InlineSyntaxRender` already
    // promises that for known token kinds; this typed indexer just removes
    // the need for an `(this as any)[name]` escape hatch when the name comes
    // from a runtime string.
    dispatch(name: string, opts: ISyntaxRenderOptions): VNode[] {
        // eslint-disable-next-line no-restricted-syntax
        const map = this as unknown as Record<string, TInlineRenderFn>;
        return map[name](opts);
    }

    output(tokens: Token[], block: Format, cursor: IRenderCursor) {
        const children: VNode[] = tokens.reduce(
            (acc, token) => [
                ...acc,
                ...this.dispatch(snakeToCamel(token.type), {
                    h,
                    cursor,
                    block,
                    token,
                }),
            ],
            [] as VNode[],
        );
        const vNode = h('span', children);
        const rawHtml = toHTML(vNode);

        return rawHtml.replace(/^<span>([\s\S]*)<\/span>$/g, (_, p) => p);
    }
}

export default Renderer;
