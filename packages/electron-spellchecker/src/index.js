const DictionarySync = require('./dictionary-sync');
const SpellCheckHandler = require('./spell-check-handler');
const SpellChecker = require('./node-spellchecker');
const UserDictionary = require('./user-dictionary');

/**
 * Overrides the default logging function (the `debug` library) with another
 * logger.
 *
 * @param {Function}  fn    The `console.log` like function that will write debug
 *                          information to.
 */
function setGlobalLogger(fn) {
  for (let klass of [DictionarySync, SpellCheckHandler, UserDictionary]) {
    klass.setLogger(fn);
  }
}

module.exports = {
  SpellCheckHandler,
  SpellChecker,
  setGlobalLogger,
};
