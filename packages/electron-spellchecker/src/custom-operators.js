const { Observable } = require('rxjs/Observable');

require('rxjs/add/observable/timer');
require('rxjs/add/operator/map');
require('rxjs/add/operator/switch');

const newCoolOperators = {
  guaranteedThrottle: function (time, scheduler=null) {
    return this
      .map((x) => Observable.timer(time, scheduler).map(() => x))
      .switch();
  }
};

for (let key of Object.keys(newCoolOperators)) {
  Observable.prototype[key] = newCoolOperators[key];
}
