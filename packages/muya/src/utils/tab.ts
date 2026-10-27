export function tabText(tabSize: number | 'tab'): string {
    return tabSize === 'tab' ? '\t' : ' '.repeat(tabSize);
}

export function isTabKey(event: Event): event is KeyboardEvent {
    return event instanceof KeyboardEvent && event.type === 'keydown' && event.key === 'Tab';
}
