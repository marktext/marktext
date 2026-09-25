import { describe, it, expect } from 'vitest'
import { buildPlantumlUrl } from 'main_renderer/ipc/plantumlUrl'

const ENCODED = 'SyfFKj2rKt3CoKnELR1Io4ZDoSa70000'

describe('buildPlantumlUrl', () => {
  it('builds the svg endpoint for the default server', () => {
    expect(buildPlantumlUrl('https://www.plantuml.com/plantuml', ENCODED, 'svg')).toBe(
      `https://www.plantuml.com/plantuml/svg/${ENCODED}`
    )
  })

  it('builds the png endpoint', () => {
    expect(buildPlantumlUrl('https://www.plantuml.com/plantuml', ENCODED, 'png')).toBe(
      `https://www.plantuml.com/plantuml/png/${ENCODED}`
    )
  })

  it('accepts a self-hosted server over plain http', () => {
    expect(buildPlantumlUrl('http://localhost:8080/plantuml', ENCODED, 'png')).toBe(
      `http://localhost:8080/plantuml/png/${ENCODED}`
    )
  })

  it('tolerates a trailing slash on the server', () => {
    expect(buildPlantumlUrl('https://example.test/plantuml/', ENCODED, 'svg')).toBe(
      `https://example.test/plantuml/svg/${ENCODED}`
    )
  })

  it('rejects a non-http scheme', () => {
    expect(buildPlantumlUrl('file:///etc/passwd', ENCODED, 'svg')).toBeNull()
    expect(buildPlantumlUrl('javascript:alert(1)', ENCODED, 'svg')).toBeNull()
  })

  it('rejects credentials in the server', () => {
    expect(buildPlantumlUrl('https://user:pass@evil.test', ENCODED, 'svg')).toBeNull()
  })

  it('rejects a server carrying a query or fragment', () => {
    expect(buildPlantumlUrl('https://example.test/p?x=1', ENCODED, 'svg')).toBeNull()
    expect(buildPlantumlUrl('https://example.test/p#f', ENCODED, 'svg')).toBeNull()
  })

  it('rejects whitespace in the server', () => {
    expect(buildPlantumlUrl('https://example.test /p', ENCODED, 'svg')).toBeNull()
  })

  it('rejects an encoding outside the PlantUML alphabet', () => {
    expect(buildPlantumlUrl('https://example.test', '../../etc/passwd', 'svg')).toBeNull()
    expect(buildPlantumlUrl('https://example.test', 'abc?x=1', 'svg')).toBeNull()
    expect(buildPlantumlUrl('https://example.test', '', 'svg')).toBeNull()
  })

  it('rejects an unknown format', () => {
    expect(
      buildPlantumlUrl('https://example.test', ENCODED, 'txt' as unknown as 'svg')
    ).toBeNull()
  })
})
