import mitt, { type Emitter } from 'mitt'

// mitt payloads are individual values; BusEvents tuple shapes would change the existing callback contract.
const emitter: Emitter<Record<string, unknown>> = mitt()

export default emitter
