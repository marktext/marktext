export default {
  baseUrl: null,
  breaks: false,
  gfm: true,
  headerIds: true,
  headerPrefix: '',
  highlight: null,
  mathRenderer: null,
  emojiRenderer: null,
  tocRenderer: null,
  langPrefix: 'language-',
  mangle: true,
  pedantic: false,
  renderer: null, // new Renderer(),
  silent: false,
  smartLists: false,
  smartypants: false,
  xhtml: false,
  disableInline: false,

  // NOTE: sanitize and sanitizer are deprecated since version 0.7.0, should not be used and will be removed in the future.
  sanitize: false,
  sanitizer: null,

  // Markdown extensions:
  // TODO: We set whether to support `emoji`, `math`, `frontMatter` default value to `true`
  // After we add user setting, we maybe set math and frontMatter default value to false.
  // User need to enable them in the user setting.
  emoji: true,
  math: true,
  frontMatter: true,
  superSubScript: false,
  footnote: false,
  isGitlabCompatibilityEnabled: false,

  isHtmlEnabled: true
}
