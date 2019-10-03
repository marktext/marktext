// NB: On Windows we still use Hunspell
if (process.platform === 'win32') {
  process.env['SPELLCHECKER_PREFER_HUNSPELL'] = 1;
}

module.exports = require('@felixrieseberg/spellchecker');
