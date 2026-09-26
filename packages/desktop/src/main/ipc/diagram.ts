import { ipcMain, net } from 'electron'
import log from 'electron-log'
import type { PlantumlFetchResult } from '@shared/types/ipc'
import { buildPlantumlUrl, type PlantumlFormat } from './plantumlUrl'
import { fetchPlantumlImage } from './plantumlFetch'

// These handlers are registered before preferences exist, so the server the
// fetch is allowed to reach is wired in once they do.
let configuredServer: (() => string) | null = null

export const setPlantumlServerSource = (source: () => string): void => {
  configuredServer = source
}

export const registerDiagramHandlers = (): void => {
  ipcMain.handle(
    'mt::diagram::fetch-plantuml',
    async(
      _e,
      server: string,
      encoded: string,
      format: PlantumlFormat
    ): Promise<PlantumlFetchResult> => {
      if (!configuredServer) return { ok: false, error: 'Invalid PlantUML request' }

      const url = buildPlantumlUrl(server, encoded, format, configuredServer())
      if (!url) return { ok: false, error: 'Invalid PlantUML request' }

      try {
        return await fetchPlantumlImage(url, net.fetch)
      } catch (err) {
        log.error('plantuml fetch failed:', err)
        return { ok: false, error: String(err instanceof Error ? err.message : err) }
      }
    }
  )
}
