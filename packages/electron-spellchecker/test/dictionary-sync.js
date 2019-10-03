require('./support');

const fs = require('fs');
const path = require('path');
const rimraf = require('rimraf');

const DictionarySync = require('../src/dictionary-sync');
const d = require('debug')('electron-spellchecker-test:dictionary-sync');

let testCount = 0;

describe('The Dictionary Sync class', function() {
  const platform = process.platform;

  beforeEach(function() {
    this.tempCacheDir = path.join(__dirname, `__dict_sync_${testCount++}`);
    this.fixture = new DictionarySync(this.tempCacheDir);
  });

  afterEach(function() {
    Object.defineProperty(process, 'platform', { value: platform });
    rimraf.sync(this.tempCacheDir);
  });

  describe('loadDictionaryForLanguage method', function() {
    this.timeout(60*1000);

    beforeEach(() => {
      Object.defineProperty(process, 'platform', { value: 'win32' });
    });

    it('should download the German dictionary', async function() {
      let buf = await this.fixture.loadDictionaryForLanguage('de-DE');

      expect(buf.constructor.name).to.equal('Buffer');
      expect(buf.length > 1000).to.be.ok;
    });

    it(`should throw when we a language that isn't real`, async function() {
      let ret = null;
      try {
        ret = await this.fixture.loadDictionaryForLanguage('zz-ZZ');
      } catch (e) {
        return;
      }

      d(ret);
      d(typeof ret);
      fs.writeFileSync('./wtfisthisfile', ret);
      throw new Error("Didn't fail!");
    });

    it('should throw when we try to load es-MX because Google doesnt have it', async function() {
      let ret = null;
      try {
        ret = await this.fixture.loadDictionaryForLanguage('es-MX');
      } catch (e) {
        return;
      }

      d(ret);
      d(typeof ret);
      fs.writeFileSync('./wtfisthisfile', ret);
      throw new Error("Didn't fail!");
    });
  });
});
