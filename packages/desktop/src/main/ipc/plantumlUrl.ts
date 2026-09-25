export type PlantumlFormat = 'svg' | 'png'

const SERVER = /^https?:\/\/[^\s?#@]{1,512}$/
const ENCODED = /^[A-Za-z0-9_-]{1,20000}$/
const FORMATS: readonly PlantumlFormat[] = ['svg', 'png']

/**
 * Compose a PlantUML render URL from the pieces the renderer sends. The
 * renderer never hands over a URL: it is untrusted, and the main process is
 * the side that can reach the network.
 */
export const buildPlantumlUrl = (
  server: string,
  encoded: string,
  format: PlantumlFormat
): string | null => {
  if (!FORMATS.includes(format)) return null
  if (!SERVER.test(server) || !ENCODED.test(encoded)) return null

  return `${server.replace(/\/+$/, '')}/${format}/${encoded}`
}
