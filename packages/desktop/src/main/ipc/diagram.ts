import { ipcMain, net } from 'electron'
import log from 'electron-log'
import type { PlantumlFetchResult } from '@shared/types/ipc'
import { buildPlantumlUrl, type PlantumlFormat } from './plantumlUrl'

const TIMEOUT_MS = 15_000
const MAX_BYTES = 20 * 1024 * 1024

export const registerDiagramHandlers = (): void => {
  ipcMain.handle(
    'mt::diagram::fetch-plantuml',
    async(_e, server: string, encoded: string, format: PlantumlFormat): Promise<PlantumlFetchResult> => {
      const url = buildPlantumlUrl(server, encoded, format)
      if (!url) return { ok: false, error: 'Invalid PlantUML request' }

      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
      try {
        const response = await net.fetch(url, { signal: controller.signal })
        if (!response.ok) return { ok: false, error: `HTTP ${response.status}` }

        const mime = response.headers.get('content-type') ?? ''
        if (!mime.startsWith('image/')) return { ok: false, error: `Unexpected content type ${mime}` }

        const declared = Number.parseInt(response.headers.get('content-length') ?? '', 10)
        if (declared > MAX_BYTES) return { ok: false, error: 'Response too large' }

        const data = new Uint8Array(await response.arrayBuffer())
        if (data.byteLength > MAX_BYTES) return { ok: false, error: 'Response too large' }

        return { ok: true, mime, data }
      } catch (err) {
        log.error('plantuml fetch failed:', err)
        return { ok: false, error: String(err instanceof Error ? err.message : err) }
      } finally {
        clearTimeout(timer)
      }
    }
  )
}
