import { describe, it, expect } from 'vitest'
import { sanitizeThemeCss } from 'main_renderer/themes/sanitize'

describe('sanitizeThemeCss', () => {
  it('keeps plain :root variable declarations and selectors', () => {
    const css = ':root {\n  --themeColor: #8da101;\n  --editorColor: #2d353b;\n}\n.token.keyword { color: #b16286; }'
    const out = sanitizeThemeCss(css)
    expect(out).to.contain('--themeColor: #8da101')
    expect(out).to.contain('.token.keyword')
  })

  it('removes @import rules', () => {
    expect(sanitizeThemeCss('@import url(https://evil.example/x.css);\n:root { --a: 1; }')).to.not.contain('@import')
    expect(sanitizeThemeCss("@import 'theme.css';\n:root {}")).to.not.contain('@import')
  })

  it('removes @font-face blocks', () => {
    const css = '@font-face { font-family: x; src: url(https://evil.example/f.woff2); }\n:root { --a: 1; }'
    const out = sanitizeThemeCss(css)
    expect(out).to.not.contain('@font-face')
    expect(out.toLowerCase()).to.not.contain('url(')
  })

  it('strips declarations using url() for remote, file and data URLs', () => {
    const remote = sanitizeThemeCss(':root { background: url(https://evil.example/x.png); --a: 1; }')
    expect(remote.toLowerCase()).to.not.contain('url(')
    const file = sanitizeThemeCss(':root { background: url(file:///etc/passwd); }')
    expect(file.toLowerCase()).to.not.contain('url(')
    const data = sanitizeThemeCss(':root { background: url(data:image/png;base64,AAAA); }')
    expect(data.toLowerCase()).to.not.contain('url(')
  })

  it('strips image-set() and -webkit-image-set()', () => {
    const out = sanitizeThemeCss(':root { background-image: -webkit-image-set(url(https://e/x.png) 1x); }')
    expect(out.toLowerCase()).to.not.contain('image-set')
    expect(out.toLowerCase()).to.not.contain('url(')
  })

  it('does not let a url() hidden in a comment survive', () => {
    const out = sanitizeThemeCss('/* background: url(https://evil.example/x) */\n:root { --a: 1; }')
    expect(out.toLowerCase()).to.not.contain('url(')
    expect(out).to.not.contain('evil.example')
  })

  it('preserves a safe declaration next to a stripped one', () => {
    const out = sanitizeThemeCss(':root { --themeColor: #fff; }\n.x { background: url(https://e/x); color: red; }')
    expect(out).to.contain('--themeColor: #fff')
    expect(out.toLowerCase()).to.not.contain('url(')
  })

  // Regression: CSS identifiers may be written with backslash escapes, so a
  // literal-text denylist must decode them first or it is trivially bypassed.
  it('decodes CSS escapes so @import cannot be smuggled past the filter', () => {
    const out = sanitizeThemeCss('@\\69 mport "https://evil.example/x.css";\n:root { --a: 1; }')
    expect(out.toLowerCase()).to.not.contain('@import')
    expect(out).to.not.contain('evil.example')
  })

  it('decodes CSS escapes so url() cannot be smuggled past the filter', () => {
    const out = sanitizeThemeCss(':root { background: \\75 rl("https://evil.example/x"); }')
    expect(out.toLowerCase()).to.not.contain('url(')
    expect(out).to.not.contain('evil.example')
  })

  it('decodes escapes inside @font-face and image-set', () => {
    const ff = sanitizeThemeCss('@\\66 ont-face { src: \\75 rl("https://evil.example/f.woff2"); }')
    expect(ff.toLowerCase()).to.not.contain('@font-face')
    expect(ff).to.not.contain('evil.example')
    const imageSet = sanitizeThemeCss(
      ':root { background-image: image\\2d set("https://evil.example/a.png" 1x); }'
    )
    expect(imageSet.toLowerCase()).to.not.contain('image-set')
    expect(imageSet).to.not.contain('evil.example')
  })

  it('removes @namespace and legacy expression()/behavior vectors', () => {
    expect(
      sanitizeThemeCss('@namespace url(http://evil.example/ns);\n:root {}').toLowerCase()
    ).to.not.contain('evil.example')
    expect(sanitizeThemeCss(':root { width: expression(alert(1)); }')).to.not.contain('expression(')
    expect(sanitizeThemeCss('.x { behavior: url(evil.htc); }').toLowerCase()).to.not.contain('url(')
  })
})
