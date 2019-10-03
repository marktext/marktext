module.exports = class FakeLocalStorage {
  constructor() {
    this.ls = {};
  }

  getItem(item) {
    return this.ls[item];
  }

  setItem(item, val) {
    this.ls[item] = val;
  }
}
