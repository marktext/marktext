// A leaf the comment layer can anchor to. `type` is the F-1.1 name
// (`paragraph`, `atxheading`, `listitem`, `taskitem`, `tablecell`, `codeblock`, …).
// `text` is that block's markdown source — `Content.text` — not the serialized
// line with list markers or quote prefixes.
export interface ITextBlockInfo {
    index: number;
    type: string;
    text: string;
}

// A non-empty range that starts and ends in one text block. Offsets are
// UTF-16 indexes into `ITextBlockInfo.text`, matching the selection model.
export interface ITextBlockSelection {
    index: number;
    start: number;
    end: number;
    text: string;
}

// A comment mark painted on one text block. `start`/`end` use the same
// offsets as `ITextBlockSelection`. `active` is the selected thread.
// `draft` is the unsaved mark: dashed underline, never the active style.
export interface IDecoration {
    id: string;
    blockIndex: number;
    start: number;
    end: number;
    active: boolean;
    draft?: boolean;
}
