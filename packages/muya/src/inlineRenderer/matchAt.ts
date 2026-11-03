const stickyPatterns = new WeakMap<RegExp, RegExp>();

export function matchAt(pattern: RegExp, src: string, index: number) {
    let sticky = stickyPatterns.get(pattern);
    if (!sticky) {
        sticky = new RegExp(pattern.source.replace(/^\^/, ''), `${pattern.flags}y`);
        stickyPatterns.set(pattern, sticky);
    }
    sticky.lastIndex = index;

    return sticky.exec(src);
}
