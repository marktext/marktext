// This function is copied from marked
export function findClosingBracket(str: string, b: string) {
    if (!str.includes(b[1]))
        return -1;

    let level = 0;

    for (let i = 0; i < str.length; i++) {
        if (str[i] === '\\') {
            i++;
        }
        else if (str[i] === b[0]) {
            level++;
        }
        else if (str[i] === b[1]) {
            level--;
            if (level < 0)
                return i;
        }
    }

    return -1;
}
