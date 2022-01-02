const hotClient = require('webpack-hot-middleware/client?reload=true')

hotClient.subscribe(event => {
  /**
   * Reload browser when HTMLWebpackPlugin emits a new index.html
   *
   * Currently disabled until jantimon/html-webpack-plugin#680 is resolved.
   * https://github.com/SimulatedGREG/electron-vue/issues/437
   * https://github.com/jantimon/html-webpack-plugin/issues/680
   */
  // if (event.action === 'reload') {
  //   window.location.reload()
  // }

  /**
   * Notify `mainWindow` when `main` process is compiling,
   * giving notice for an expected reload of the `electron` process
   */
  if (event.action === 'compiling') {
    document.body.innerHTML += `
      <style>
        #dev-client {
          background: #4fc08d;
          border-radius: 4px;
          bottom: 20px;
          box-shadow: 0 4px 5px 0 rgba(0, 0, 0, 0.14), 0 1px 10px 0 rgba(0, 0, 0, 0.12), 0 2px 4px -1px rgba(0, 0, 0, 0.3);
          color: #fff;
          font-family: 'Source Sans Pro', sans-serif;
          left: 20px;
          padding: 8px 12px;
          position: absolute;
        }
      </style>

      <div id="dev-client">
        Compiling Main Process...
      </div>
    `
  }
})
