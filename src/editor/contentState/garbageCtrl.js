const garbageCtrl = ContentState => {
  ContentState.prototype.garbageCollection = function () {
    for (let key of this.keys) {
      if (!document.querySelector(`#${key}`)) {
        this.keys.delete(key)
      }
    }
    console.log(this.keys.size)
  }
}

export default garbageCtrl
