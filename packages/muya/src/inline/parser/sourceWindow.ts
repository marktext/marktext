/** Scanner-local indexes and public token offsets both count UTF-16 code units. */
export class SourceWindow {
    constructor(readonly source: string, readonly offset = 0) {}

    get end(): number {
        return this.offset + this.source.length;
    }

    local(blockOffset: number): number {
        return blockOffset - this.offset;
    }

    absolute(localOffset: number): number {
        return this.offset + localOffset;
    }
}
