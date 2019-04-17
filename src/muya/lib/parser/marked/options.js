export default {
  baseUrl: null,
  breaks: false,
  gfm: true,
  // TODO: We set weather to support `emoji`, `math`, `frontMatter` default value to `true`
  // After we add user setting, we maybe set math and frontMatter default value to false.
  // User need to enable them in the user setting.
  emoji: true,
  math: true,
  frontMatter: true,
  headerIds: true,
  headerPrefix: '',
  highlight: null,
  mathRenderer: null,
  emojiRenderer: null,
  langPrefix: 'language-',
  mangle: true,
  pedantic: false,
  renderer: null, // new Renderer(),
  sanitize: false,
  sanitizer: null,
  silent: false,
  smartLists: false,
  smartypants: false,
  tables: true,
  xhtml: false,
  disableInline: false
}
