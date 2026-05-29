// Event payloads are heterogeneous and per-event-name; the emitter does
// `listener(...args)` with arbitrary args and the receiver destructures an
// event-specific shape. Typed alternatives (`unknown[]` / `never[]`) force
// every existing consumer to widen or narrow, which is invasive enough to
// be its own follow-up. Keep the existing `any[]` here; future work can
// introduce a typed event map.
// eslint-disable-next-line ts/no-explicit-any
export type Listener = (...args: any[]) => void;

export interface IEvent {
    eventId: string;
    target: HTMLElement | Document;
    event: string;
    listener: EventListenerOrEventListenerObject;
    capture?: boolean | AddEventListenerOptions;
}

export interface IListeners {
    [key: string]: {
        listener: Listener;
        once: boolean;
    }[];
}
