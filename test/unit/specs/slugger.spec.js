import Slugger from 'muya/lib/parser/marked/slugger'

describe('Slugger', () => {
  let slugger

  beforeEach(() => {
    slugger = new Slugger()
  })

  describe('basic slug generation', () => {
    it('should generate a slug from plain text', () => {
      expect(slugger.slug('Hello World')).to.equal('hello-world')
    })

    it('should convert to lowercase', () => {
      expect(slugger.slug('HELLO')).to.equal('hello')
    })

    it('should replace spaces with hyphens', () => {
      expect(slugger.slug('foo bar baz')).to.equal('foo-bar-baz')
    })

    it('should strip special characters', () => {
      expect(slugger.slug('Hello, World!')).to.equal('hello-world')
    })

    it('should strip parentheses and brackets', () => {
      expect(slugger.slug('Section (1) [intro]')).to.equal('section-1-intro')
    })

    it('should strip HTML tags', () => {
      expect(slugger.slug('Hello <b>World</b>')).to.equal('hello-world')
    })
  })

  describe('empty and special-character-only headings (#4087)', () => {
    it('should return "heading" for empty string', () => {
      expect(slugger.slug('')).to.equal('heading')
    })

    it('should return "heading" for whitespace-only input', () => {
      expect(slugger.slug('   ')).to.equal('heading')
    })

    it('should return "heading" for input with only special characters', () => {
      expect(slugger.slug('!@#$%^&*()')).to.equal('heading')
    })

    it('should return "heading" for input with only punctuation', () => {
      expect(slugger.slug('.,;:!?')).to.equal('heading')
    })

    it('should deduplicate fallback headings', () => {
      expect(slugger.slug('')).to.equal('heading')
      expect(slugger.slug('')).to.equal('heading-1')
      expect(slugger.slug('')).to.equal('heading-2')
    })

    it('should deduplicate when fallback collides with real heading', () => {
      expect(slugger.slug('heading')).to.equal('heading')
      expect(slugger.slug('')).to.equal('heading-1')
    })

    it('should deduplicate when empty heading appears before real "heading"', () => {
      expect(slugger.slug('')).to.equal('heading')
      expect(slugger.slug('heading')).to.equal('heading-1')
    })

    it('should handle chained collisions with fallback slugs', () => {
      expect(slugger.slug('')).to.equal('heading')
      expect(slugger.slug('')).to.equal('heading-1')
      expect(slugger.slug('heading-1')).to.equal('heading-1-1')
    })
  })

  describe('unicode and emoji headings', () => {
    it('should handle CJK characters', () => {
      const slug = slugger.slug('你好世界')
      expect(slug).to.be.a('string')
      expect(slug.length).to.be.greaterThan(0)
    })

    it('should handle emoji-only heading', () => {
      const slug = slugger.slug('🚀🎉')
      expect(slug).to.be.a('string')
      expect(slug.length).to.be.greaterThan(0)
    })

    it('should handle mixed ASCII and Unicode', () => {
      const slug = slugger.slug('Hello 世界')
      expect(slug).to.be.a('string')
      expect(slug.length).to.be.greaterThan(0)
    })
  })

  describe('deduplication', () => {
    it('should append suffix for duplicate slugs', () => {
      expect(slugger.slug('hello')).to.equal('hello')
      expect(slugger.slug('hello')).to.equal('hello-1')
      expect(slugger.slug('hello')).to.equal('hello-2')
    })

    it('should handle duplicates independently', () => {
      expect(slugger.slug('foo')).to.equal('foo')
      expect(slugger.slug('bar')).to.equal('bar')
      expect(slugger.slug('foo')).to.equal('foo-1')
      expect(slugger.slug('bar')).to.equal('bar-1')
    })
  })
})
