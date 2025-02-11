const path = require('path');
const HtmlBundlerPlugin = require('../../../');

module.exports = {
  mode: 'production',

  output: {
    path: path.join(__dirname, 'dist/'),
  },

  resolve: {
    alias: {
      '@images': path.join(__dirname, '../../fixtures/images'),
    },
  },

  plugins: [
    new HtmlBundlerPlugin({
      entry: {
        index: {
          import: './src/index.html',
          data: {
            title: 'Home',
            headline: 'Breaking Bad',
            name: {
              firstname: 'Walter',
              lastname: 'White',
            },
          },
          filename: (PathData) => {
            // TODO: add test for PathData.chunk.name and PathData.chunk.runtime
            // console.log('>>> filename: ', {
            //   PathData,
            // });

            return '[name].html';
          },
        },
      },
      loaderOptions: {
        // test preprocessor return null, has the same effect as `preprocessor: false`
        preprocessor: (tmpl, loaderContext) => {
          // TODO: add test for loaderContext.entryName
          // console.log('### preprocessor: ', {
          //   entryId: loaderContext.entryId,
          //   name: loaderContext.name,
          //   entryName: loaderContext.entryName,
          //   entryData: loaderContext.data,
          //   resourcePath: loaderContext.resourcePath,
          // });
          return null;
        },
      },
    }),
  ],

  module: {
    rules: [
      {
        test: /\.(png|svg|jpe?g|webp)$/i,
        type: 'asset/resource',
        generator: {
          filename: 'assets/img/[name].[hash:8][ext]',
        },
      },
    ],
  },
};
