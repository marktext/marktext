import { describe, it, expect } from 'vitest'
import { buildPlantumlUrl } from 'main_renderer/ipc/plantumlUrl'

const ENCODED = 'SyfFKj2rKt3CoKnELR1Io4ZDoSa70000'
const DEFAULT_SERVER = 'https://www.plantuml.com/plantuml'

describe('buildPlantumlUrl', () => {
  it('builds the svg endpoint for the default server', () => {
    expect(buildPlantumlUrl('https://www.plantuml.com/plantuml', ENCODED, 'svg', 'https://www.plantuml.com/plantuml')).toBe(
      `https://www.plantuml.com/plantuml/svg/${ENCODED}`
    )
  })

  it('builds the png endpoint', () => {
    expect(buildPlantumlUrl('https://www.plantuml.com/plantuml', ENCODED, 'png', 'https://www.plantuml.com/plantuml')).toBe(
      `https://www.plantuml.com/plantuml/png/${ENCODED}`
    )
  })

  it('accepts a self-hosted server over plain http', () => {
    expect(buildPlantumlUrl('http://localhost:8080/plantuml', ENCODED, 'png', 'http://localhost:8080/plantuml')).toBe(
      `http://localhost:8080/plantuml/png/${ENCODED}`
    )
  })

  it('tolerates a trailing slash on the server', () => {
    expect(buildPlantumlUrl('https://example.test/plantuml/', ENCODED, 'svg', 'https://example.test/plantuml/')).toBe(
      `https://example.test/plantuml/svg/${ENCODED}`
    )
  })

  it('rejects a non-http scheme', () => {
    expect(buildPlantumlUrl('file:///etc/passwd', ENCODED, 'svg', 'file:///etc/passwd')).toBeNull()
    expect(buildPlantumlUrl('javascript:alert(1)', ENCODED, 'svg', 'javascript:alert(1)')).toBeNull()
  })

  it('rejects credentials in the server', () => {
    expect(buildPlantumlUrl('https://user:pass@evil.test', ENCODED, 'svg', 'https://user:pass@evil.test')).toBeNull()
  })

  it('rejects a server carrying a query or fragment', () => {
    expect(buildPlantumlUrl('https://example.test/p?x=1', ENCODED, 'svg', 'https://example.test/p?x=1')).toBeNull()
    expect(buildPlantumlUrl('https://example.test/p#f', ENCODED, 'svg', 'https://example.test/p#f')).toBeNull()
  })

  it('rejects whitespace in the server', () => {
    expect(buildPlantumlUrl('https://example.test /p', ENCODED, 'svg', 'https://example.test /p')).toBeNull()
  })

  it('rejects an encoding outside the PlantUML alphabet', () => {
    expect(buildPlantumlUrl('https://example.test', '../../etc/passwd', 'svg', 'https://example.test')).toBeNull()
    expect(buildPlantumlUrl('https://example.test', 'abc?x=1', 'svg', 'https://example.test')).toBeNull()
    expect(buildPlantumlUrl('https://example.test', '', 'svg', 'https://example.test')).toBeNull()
  })

  it('rejects an unknown format', () => {
    expect(
      buildPlantumlUrl('https://example.test', ENCODED, 'txt' as unknown as 'svg', 'https://example.test')
    ).toBeNull()
  })
})

describe('buildPlantumlUrl server identity', () => {
  it('refuses a server the user did not configure', () => {
    expect(buildPlantumlUrl('http://127.0.0.1:9200', ENCODED, 'png', DEFAULT_SERVER)).toBeNull()
    expect(
      buildPlantumlUrl('http://169.254.169.254/latest', ENCODED, 'svg', DEFAULT_SERVER)
    ).toBeNull()
  })

  it('refuses a look-alike host', () => {
    expect(
      buildPlantumlUrl('https://www.plantuml.com.evil.test/plantuml', ENCODED, 'svg', DEFAULT_SERVER)
    ).toBeNull()
    expect(
      buildPlantumlUrl('https://www.plantuml.com/plantuml/../x', ENCODED, 'svg', DEFAULT_SERVER)
    ).toBeNull()
  })

  it('builds against a self-hosted server once it is the configured one', () => {
    const server = 'http://localhost:8080/plantuml'
    expect(buildPlantumlUrl(server, ENCODED, 'png', server)).toBe(
      `${server}/png/${ENCODED}`
    )
    expect(buildPlantumlUrl(server, ENCODED, 'png', DEFAULT_SERVER)).toBeNull()
  })

  it('treats an unset preference as the public server, which is what muya renders', () => {
    expect(buildPlantumlUrl(DEFAULT_SERVER, ENCODED, 'svg', '')).toBe(
      `${DEFAULT_SERVER}/svg/${ENCODED}`
    )
    expect(buildPlantumlUrl('http://127.0.0.1:9200', ENCODED, 'svg', '')).toBeNull()
  })

  it('ignores a trailing slash on either side', () => {
    expect(buildPlantumlUrl(`${DEFAULT_SERVER}/`, ENCODED, 'svg', DEFAULT_SERVER)).toBe(
      `${DEFAULT_SERVER}/svg/${ENCODED}`
    )
    expect(buildPlantumlUrl(DEFAULT_SERVER, ENCODED, 'svg', `${DEFAULT_SERVER}/`)).toBe(
      `${DEFAULT_SERVER}/svg/${ENCODED}`
    )
  })

  it('refuses a configured server that is itself malformed', () => {
    expect(buildPlantumlUrl('https://ok.test', ENCODED, 'svg', 'file:///etc')).toBeNull()
    expect(
      buildPlantumlUrl('https://user:pass@ok.test', ENCODED, 'svg', 'https://user:pass@ok.test')
    ).toBeNull()
  })
})
