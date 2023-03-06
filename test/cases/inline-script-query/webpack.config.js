const path = require('path');
const HtmlBundlerPlugin = require('../../../');

module.exports = {
  mode: 'production',

  output: {
    path: path.join(__dirname, 'dist/'),
  },

  resolve: {
    alias: {
      Scripts: path.join(__dirname, 'src/assets/scripts/'),
    },
  },

  plugins: [
    new HtmlBundlerPlugin({
      verbose: true, // test verbose
      entry: {
        index: './src/views/index.html',
      },
      js: {
        filename: 'assets/js/[name].[contenthash:8].js',
      },
    }),
  ],
};
