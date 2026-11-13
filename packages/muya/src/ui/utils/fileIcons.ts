import fileIcons from '@marktext/file-icons';
import '@marktext/file-icons/build/index.css';

function getClassByName(name: string) {
    const icon = fileIcons.matchName(name);

    return icon ? icon.getClass(0, false) : null;
}

function getClassByLanguage(lang: string) {
    const icon = fileIcons.matchLanguage(lang);

    return icon ? icon.getClass(0, false) : null;
}

export default { getClassByName, getClassByLanguage };
