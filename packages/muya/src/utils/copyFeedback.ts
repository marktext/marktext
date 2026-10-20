import type I18n from '../i18n';

const timers = new WeakMap<HTMLElement, ReturnType<typeof setTimeout>>();

export function showCopyFeedback(button: HTMLElement, ok: boolean, label: string, i18n: I18n) {
    clearTimeout(timers.get(button));
    const message = i18n.t(ok ? 'Copied' : 'Copy failed');
    button.classList.toggle('mu-copy-success', ok);
    button.setAttribute('title', message);
    button.setAttribute('aria-label', message);
    if (ok)
        delete button.dataset.copyFeedback;
    else
        button.dataset.copyFeedback = message;
    timers.set(button, setTimeout(() => {
        button.classList.remove('mu-copy-success');
        delete button.dataset.copyFeedback;
        button.setAttribute('title', label);
        button.setAttribute('aria-label', label);
        timers.delete(button);
    }, 2000));
}
