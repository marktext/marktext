# TextPack documents

MarkText can open and edit compressed TextBundle documents with the `.textpack` extension. A TextPack remains one portable file while its Markdown text, images, other resources, and metadata are stored in an open ZIP-based layout.

## Use

- Open a `.textpack` from **File → Open**, the recent-files menu, the command line, a file association, or by dropping it on MarkText.
- Edit it like any other Markdown document. Relative `assets/...` images resolve inside the bundle.
- Pasted or dropped images are copied into the bundle's `assets/` directory. The Markdown keeps a portable POSIX-style `assets/...` reference.
- **Save** rebuilds and validates a temporary archive, then replaces the original. External changes enter MarkText's existing file-change flow; a final source-revision check also prevents a changed archive from being overwritten during a race.
- Saving a Markdown or untitled document as `.textpack` embeds Base64 image data, local absolute/file-URL images, and relative local link/image targets. Inline images, reference-style images, and HTML `<img src>` are supported. Source files are copied, never moved. Missing or invalid resources cancel conversion without replacing the destination.
- Saving a TextPack as Markdown exports its complete `assets/` directory as `<document>.assets` and rewrites Markdown destinations accordingly.

## Compatibility and safety

MarkText accepts TextBundle versions 1 and 2 with a Markdown type (or no type), a lowercase root `info.json`, and exactly one root `text.*`. It preserves unknown metadata, unknown files, and unreferenced assets when saving back to TextPack. Text is decoded as strict UTF-8; a UTF-8 BOM is accepted.

Archives containing traversal/absolute paths, backslashes, platform device names, duplicate case-folded names, symbolic links, encrypted entries, excessive entry counts/sizes, or suspicious compression ratios are rejected before a tab opens.

## Current preview limitations

- Relative resources in an untitled document have no known source directory. Save the Markdown beside its resources first; TextPack conversion deliberately does not guess a directory. Base64, absolute paths, and file URLs do not need a source directory.
- HTTP/HTTPS and protocol-relative images remain remote links. The conversion implementation has an internal `remoteImages: 'preserve' | 'embed'` option, defaulting to `preserve`. `embed` is reserved and explicitly fails as unimplemented. No MarkText preference, settings UI, or package metadata field is added.
- The source-position scanner is not a full CommonMark parser. Complex nested block syntax and HTML `srcset`/CSS images are not currently supported. Embedded image data must use a supported Base64 image MIME type; invalid or unsupported image data fails conversion explicitly.
- TextPack does not add a generic non-image attachment insertion UI. Non-image drag-and-drop keeps MarkText's existing behavior, while arbitrary files already stored under `assets/` are preserved and relative local files referenced by Markdown links are collected during conversion.
- Recovery reuses resource workspaces left by an abnormal exit, together with MarkText's existing buffered Markdown recovery. There is not yet a dedicated recovery-candidate picker.
- External changes use the existing MarkText reload notification. MarkText stages the changed archive without disturbing local resources and switches the Markdown and complete resource workspace together only when the existing reload flow accepts the external version.
