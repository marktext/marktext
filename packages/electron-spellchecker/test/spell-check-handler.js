require('./support');

const path = require('path');
const rimraf = require('rimraf');
const {next, TestScheduler} = require('@kwonoj/rxjs-testscheduler-compat');
const FakeLocalStorage = require('../src/fake-local-storage');

const DictionarySync = require('../src/dictionary-sync');
const SpellCheckHandler = require('../src/spell-check-handler');

const d = require('debug')('electron-spellchecker-test:spell-check-handler');

let testCount = 0;

const deDE = "Rechtschreibprüfungsleid ist eine Grunderfahrung und bezeichnet als Sammelbegriff all dasjenige, was einen Menschen körperlich und seelisch belastet.";

describe('The Spell Check Handler Class', function() {
  const platform = process.platform;

  beforeEach(function () {
    this.tempCacheDir = path.join(__dirname, `__spell_check${testCount++}`);
    this.sync = new DictionarySync(this.tempCacheDir);
    this.fixture = new SpellCheckHandler(this.sync, new FakeLocalStorage());
  });

  afterEach(function () {
    Object.defineProperty(process, 'platform', { value: platform });

    rimraf.sync(this.tempCacheDir);
  });

  describe('buildLikelyLocaleTable method', function() {
    it('should have de in the list', async function() {
      let result = await this.fixture.buildLikelyLocaleTable();
      d(JSON.stringify(result));

      expect(result['de']).to.be.ok;
    });
  });

  describe('the setLanguage method', function() {
    this.timeout(30*1000);

    it('should load a bunch of common languages', async function() {
      await this.fixture.switchLanguage('en-US');

      expect(this.fixture.currentSpellchecker.isMisspelled('bucket')).not.to.be.ok;
      expect(this.fixture.currentSpellchecker.isMisspelled('Eimer')).to.be.ok;

      await this.fixture.switchLanguage('de-DE');

      expect(this.fixture.currentSpellchecker.isMisspelled('bucket')).to.be.ok;
      expect(this.fixture.currentSpellchecker.isMisspelled('Eimer')).not.to.be.ok;
    });

    it.skip('should log some stuff', async function() {
      // NB: This test is skipped because it will wreck the logger for the other
      // tests, but it's still a good test!
      let result = [];
      SpellCheckHandler.setLogger((...args) => result.push(...args));

      expect(result.length).to.equal(0);
      await this.fixture.switchLanguage('de-DE');

      let currentLength = result.length;
      expect(result.length > 0).to.be.ok;

      await this.fixture.switchLanguage('en-US');
      expect(result.length > 0).to.be.ok;
      expect(result.length > currentLength).to.be.ok;
    });
  });

  describe('the loadDictionaryForLanguageWithAlternatives method', function() {
    this.timeout(30*1000);

    beforeEach(() => {
      Object.defineProperty(process, 'platform', { value: 'win32' });
    });

    it('should load a simple example', async function() {
      this.fixture.likelyLocaleTable = { 'en': 'en-US' };
      let result = await this.fixture.loadDictionaryForLanguageWithAlternatives('en-US');

      expect(result.language).to.equal('en-US');
    });


    it('should load a fallback example', async function() {
      // NB: Google doesn't have an es-MX dictionary
      this.fixture.likelyLocaleTable = { 'es': 'es-ES' };
      let result = await this.fixture.loadDictionaryForLanguageWithAlternatives('es-MX');

      expect(result.language).to.equal('es-ES');
      expect(result.dictionary.length > 5000).to.be.ok;
    });
  });

  describe('the attachToInput method', function() {
    it('should use TestScheduler correctly', function() {
      let scheduler = new TestScheduler();
      let input = scheduler.createHotObservable(
        next(250, 'This is a test of a long english sentence')
      );

      let items = [];
      input.subscribe((x) => items.push(x));

      expect(items.length).to.equal(0);

      scheduler.advanceTo(100);
      expect(items.length).to.equal(0);

      scheduler.advanceTo(300);
      expect(items.length).to.equal(1);
    });

    it('should detect the simple case of pasting in a long string', async function(done) {
      this.timeout(15 * 1000);

      let scheduler = new TestScheduler();
      let input = scheduler.createHotObservable(
        next(250, 'This is a test of a long english sentence')
      );

      this.fixture.scheduler = scheduler;
      this.fixture.attachToInput(input);

      if (process.platform === 'darwin') {
        expect(this.fixture.currentSpellcheckerLanguage).to.equal('en-US');
        return done();
      } else {
        expect(this.fixture.currentSpellcheckerLanguage).not.to.be.ok;
      }

      scheduler.advanceTo(10 * 1000);
      await this.fixture.currentSpellcheckerChanged.take(1).toPromise();

      expect(this.fixture.currentSpellcheckerLanguage).to.equal('en-US');

      done();
    });

    it('should switch languages if users type different text', async function() {
      this.timeout(15 * 1000);

      let scheduler = new TestScheduler();
      let input = scheduler.createHotObservable(
        next(10, 'This is a test of a long english sentence'),
        next(15*1000, ''),
        next(30*1000, deDE)
      ).do((x) => d(`Emitted ${x}`)).publish().refCount();

      this.fixture.scheduler = scheduler;
      this.fixture.attachToInput(input);

      if (process.platform === 'darwin') {
        expect(this.fixture.currentSpellcheckerLanguage).to.equal('en-US');
      } else {
        expect(this.fixture.currentSpellcheckerLanguage).not.to.be.ok;
      }

      d('Advancing to +10s');
      scheduler.advanceTo(10*1000);
      if (process.platform !== 'darwin') {
        this.fixture.currentSpellcheckerChanged.take(1).toPromise();
      }

      expect(this.fixture.currentSpellcheckerLanguage).to.equal('en-US');

      d('Advancing to +20s');
      scheduler.advanceTo(20*1000);
      await new Promise((req) => setTimeout(req, 50));
      expect(this.fixture.currentSpellcheckerLanguage).to.equal('en-US');

      d('Advancing to +50s, faking up some spelling mistakes');
      scheduler.advanceTo(50*1000);
      this.fixture.spellingErrorOccurred.next('ist');
      this.fixture.spellingErrorOccurred.next('eine');

      d('Advancing to +60s');
      scheduler.advanceTo(60*1000);
      await this.fixture.currentSpellcheckerChanged.take(1).toPromise();
      expect(this.fixture.currentSpellcheckerLanguage.substring(0,2)).to.equal('de');
    });
  });
});
