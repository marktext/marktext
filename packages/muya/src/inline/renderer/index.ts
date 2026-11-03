import type { VNode } from 'snabbdom';
import type { Token } from '../model/types';
import type { ImageMounts } from '../resources/imageMounts';
import type { IContainerRenderOptions, IInlineCursor, IInlineEnvironment, IRenderBlock } from './types';
import { CLASS_NAMES } from '../../config';
import { conflict } from '../../utils';
import { h } from '../../utils/snabbdom';
import { vnodeToHTML } from '../../utils/vnodeToHTML';
import { tokenEvents } from '../model/traversal';
import { ImageResources } from '../resources/images';
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
import htmlTag, { isLiteralHtml } from './htmlTag';
import image from './image';
import inlineCode from './inlineCode';
import inlineDiff from './inlineDiff';
import inlineMath from './inlineMath';
import lineBreakHighlights from './lineBreakHighlights';
import link from './link';
import loadImageAsync from './loadImageAsync';
import mark from './mark';
import multipleMath from './multipleMath';
import referenceDefinition from './referenceDefinition';
import referenceImage from './referenceImage';
import referenceLink from './referenceLink';
import softLineBreak from './softLineBreak';
import strong from './strong';
import superSubScript from './superSubScript';
import tailHeader from './tailHeader';
import text from './text';

class Renderer {
    backlashInToken = backlashInToken;
    highlight = highlight;
    lineBreakHighlights = lineBreakHighlights;
    loadImageAsync = loadImageAsync;
    image = image;
    delEmStrongFac = delEmStrongFac;
    htmlRuby = htmlRuby;

    public loadMathMap: Map<
        string,
    string | VNode | (string | VNode)[] | undefined
    > = new Map();

    readonly images: ImageResources;

    constructor(private _environment: () => IInlineEnvironment, readonly mounts: ImageMounts, images = new ImageResources()) {
        this.images = images;
    }

    get environment(): IInlineEnvironment {
        return this._environment();
    }

    private _checkConflicted(block: IRenderBlock, token: Pick<Token, 'range'>, cursor: IInlineCursor = {}) {
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
        block: IRenderBlock,
        token: Pick<Token, 'range'>,
        cursor: IInlineCursor,
    ) {
        if (this.environment.readOnly)
            return CLASS_NAMES.MU_HIDE;
        return (
            outerClass
            || (this._checkConflicted(block, token, cursor)
                ? CLASS_NAMES.MU_GRAY
                : CLASS_NAMES.MU_HIDE)
        );
    }

    getHighlightClassName(active: boolean) {
        return active ? CLASS_NAMES.MU_HIGHLIGHT : CLASS_NAMES.MU_SELECTION;
    }

    // Exhaustive syntax dispatch keeps every token/handler pair checked by TypeScript.
    // eslint-disable-next-line complexity
    renderToken(opts: IContainerRenderOptions): (VNode | string)[] {
        const { token } = opts;
        switch (token.type) {
            case 'backlash':
                return backlash.call(this, { ...opts, token });
            case 'header':
                return header.call(this, { ...opts, token });
            case 'link':
                return link.call(this, { ...opts, token });
            case 'html_tag':
                return htmlTag.call(this, { ...opts, token });
            case 'hr':
                return hr.call(this, { ...opts, token });
            case 'tail_header':
                return tailHeader.call(this, { ...opts, token });
            case 'hard_line_break':
                return hardLineBreak.call(this, { ...opts, token });
            case 'soft_line_break':
                return softLineBreak.call(this, { ...opts, token });
            case 'code_fence':
                return codeFence.call(this, { ...opts, token });
            case 'inline_math':
                return inlineMath.call(this, { ...opts, token });
            case 'auto_link':
                return autoLink.call(this, { ...opts, token });
            case 'auto_link_extension':
                return autoLinkExtension.call(this, { ...opts, token });
            case 'image':
                return image.call(this, { ...opts, token });
            case 'emoji':
                return emoji.call(this, { ...opts, token });
            case 'inline_code':
                return inlineCode.call(this, { ...opts, token });
            case 'inline_diff':
                return inlineDiff.call(this, { ...opts, token });
            case 'text':
                return text.call(this, { ...opts, token });
            case 'del':
                return del.call(this, { ...opts, token });
            case 'mark':
                return mark.call(this, { ...opts, token });
            case 'em':
                return em.call(this, { ...opts, token });
            case 'strong':
                return strong.call(this, { ...opts, token });
            case 'html_escape':
                return htmlEscape.call(this, { ...opts, token });
            case 'multiple_math':
                return multipleMath.call(this, { ...opts, token });
            case 'reference_definition':
                return referenceDefinition.call(this, { ...opts, token });
            case 'reference_link':
                return referenceLink.call(this, { ...opts, token });
            case 'reference_image':
                return referenceImage.call(this, { ...opts, token });
            case 'super_sub_script':
                return superSubScript.call(this, { ...opts, token });
            case 'footnote_identifier':
                return footnoteIdentifier.call(this, { ...opts, token });
            default: {
                const unreachable: never = token;
                throw new Error(`Unknown inline token: ${unreachable}`);
            }
        }
    }

    invalidateImages(): void {
        this.mounts.clear();
        this.images.invalidate();
    }

    dispose(): void {
        this.mounts.dispose();
        this.images.dispose();
        this.loadMathMap.clear();
    }

    output(tokens: Token[], block: IRenderBlock, cursor: IInlineCursor) {
        const snapshot = this.environment;
        const environment = { ...snapshot, root: block.domNode || snapshot.root };
        const session = new Renderer(() => environment, this.mounts, this.images);
        session.loadMathMap = this.loadMathMap;
        const rendered = new Map<Token, (VNode | string)[]>();
        const childNodes = (children: readonly Token[]) => {
            const nodes: (VNode | string)[] = [];
            for (const token of children)
                nodes.push(...rendered.get(token)!);
            return nodes;
        };
        // Parents reuse completed child nodes; each output call owns its session.
        for (const { token, exiting } of tokenEvents(tokens, token =>
            token.type !== 'image' && token.type !== 'reference_image'
            && (token.type !== 'html_tag' || (!isLiteralHtml(token) && token.tag !== 'ruby')))) {
            if (!exiting)
                continue;
            rendered.set(token, session.renderToken({ h, cursor, block, token, childNodes }));
        }
        const rawHtml = vnodeToHTML(h('span', childNodes(tokens)));
        return rawHtml.slice(6, -7);
    }
}

export default Renderer;
