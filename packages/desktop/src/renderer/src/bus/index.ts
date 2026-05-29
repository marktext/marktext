import mitt, { type Emitter } from 'mitt'

// NOTE: We intentionally use mitt's default (string → unknown) event map
// rather than `BusEvents` from `@shared/types/bus`. `BusEvents` uses a
// tuple/`unknown[]` payload shape (designed for the Node EventEmitter
// `...args` convention), but mitt is strictly single-arg
// (`emit(type, event)`). Adopting `BusEvents<unknown[]>` here would
// require wrapping every existing emit call in an array, changing
// runtime semantics. As individual events are typed in later commits,
// we can swap to a tuple-aware wrapper.
const emitter: Emitter<Record<string, unknown>> = mitt()

export default emitter
