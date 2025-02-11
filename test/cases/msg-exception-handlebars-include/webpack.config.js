const HtmlBundlerPlugin = require('../../../');

module.exports = {
  mode: 'production',

  plugins: [
    new HtmlBundlerPlugin({
      entry: {
        index: './src/index.html',
      },
      loaderOptions: {
        preprocessor: 'handlebars',
        preprocessorOptions: {
          //views: [path.join(__dirname, 'src/partials/')], // test without views option
        },
      },
    }),
  ],
};
