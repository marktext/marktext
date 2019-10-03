const cld = require('cld');

module.exports = {
  detect: function (text) {
    return new Promise((res,rej) => {
      cld.detect(text, (err, result) => {
        if (err) { rej(new Error(err.message)); return; }
        if (!result.reliable || result.languages[0].percent < 85) {
          rej(new Error('Not enough reliable text'));
          return;
        }

        res(result.languages[0].code);
      });
    });
  }
}
