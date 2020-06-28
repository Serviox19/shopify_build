/* eslint-disable */
const reader = require('yaml-reader');
const config = reader.read('config.yml');
const themeID = config.development.theme_id;
const storeURL = config.development.store;
const webpack = require('webpack');
const BrowserSyncPlugin = require('browser-sync-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const Shopify = require('shopify-api-node');

// webpack build
const path = require('path');
const MiniCssExtractPlugin = require("mini-css-extract-plugin");


// webpack build
const path = require('path');
const MiniCssExtractPlugin = require("mini-css-extract-plugin");

let BrowserSyncFlag = false;

function colorCodeString(data) {
  data = data.replace(/\[([^\]]+)\]/g, '[\x1b[32m$1\x1b[0m]'); // handles files [folder]/[file]
  data = data.replace(/](\s\w+\s)(.+)/g, ']$1\x1b[34m$2\x1b[0m'); // handles env [<env>]
  data = data.replace(/]\s([A-Za-z0-9_]+):/g, '] \x1b[33m$1\x1b[0m:'); // handles store [store]:
  data = data.replace(/(\s\d+\s)/g, '\x1b[33m$1\x1b[0m'); // handles theme_id [theme_id]
  return data;
}

function initBrowserSync() {
  if (BrowserSyncFlag) {
    return;
  }
  BrowserSyncFlag = true;
  BrowserSyncPlugin({
    host: 'localhost',
    port: 3000,
    files: [
      './dist/**/*.css'
    ],
    open: 'external',
    proxy: {
      target: `https://${storeURL}?preview_theme_id=${themeID}&_fd=0`
    },
    callbacks: {
      ready: function(err, bs) {
        themkitInit(Object.keys(config).pop(), bs)
      }
    },
    reloadDelay: 300,
    snippetOptions: {
      rule: {
        match: /<\/body>/i,
        fn: (snippet, match) => {
          return `${snippet}${match}`;
        }
      }
    },
    injectChanges: false
  });
}

function themkitInit(env, bs) {
  let timeout;
  const options = {
    env: env,
    config: path.resolve(__dirname, 'config.yml')
  };
  themeKit.command('watch', options, {
    pipe: ['inherit', 'pipe', 'pipe']
  }).then(child => {
    child.stdout.on('data', function(data) {
      let dataString = data.toString()
      let dataOut = colorCodeString(dataString);
      if (BrowserSyncPlugin) {
        if (dataString.match('Updated') && !dataString.match('processing') && !dataString.match(/\.map$/g) && !dataString.match('bundle.css') && !dataString.match('bundle.css.map') && !dataString.match(/\.(png|jpe?g|gif|svg|ttf|woff2?|otf)/)) {
          clearTimeout(timeout)
          timeout = setTimeout(() => {
            BrowserSyncPlugin.reload()
          }, 1000);
        }
      } else {
        console.clear()
      }
      console.log(dataOut.trim());
    })
  }).catch(e => {
    console.log(e);
  });
}

module.exports = {
  entry: {
    main: ['@babel/polyfill', './src/scripts/app.js', './src/styles/theme.scss']
  },
  mode: 'development',
  output: {
    filename: 'compiled.js',
    path: path.resolve(__dirname, 'src/assets')
  },
  externals: {
    "jquery": "jQuery"
  },
  module: {
    rules: [{
        test: /\.s(a|c)ss$/,
        use: [{
            loader: 'style-loader'
          },
          {
            loader: MiniCssExtractPlugin.loader
            // loader: process.env.NODE_ENV !== 'production' ? 'style-loader' : MiniCssExtractPlugin.loader
          },
          {
            loader: 'css-loader'
          },
          {
            loader: 'postcss-loader',
            options: {
              ident: 'postcss',
              plugins: (loader) => [
                require('postcss-preset-env')(),
                require('cssnano')()
              ]
            }
          },
          {
            loader: 'sass-loader',
            options: {
              sourceMap: true,
              // includePaths: [
              //     path.resolve(__dirname, './node_modules')
              // ]
            }
          }
        ]
      },
      {
        test: /\.css$/,
        use: [
          'style-loader',
          'css-loader'
        ]
      },
      {
        test: /\.(ttf|eot|woff|woff2|svg|otf)$/,
        loader: "url-loader?limit=100000",
        options: {
          name: "[name].[ext]",
        },
      },
      {
        test: /\.(png|jpg|gif|jpeg)$/,
        loader: 'url-loader?limit=100000'
      },
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
        }
      }
    ]
  },
  plugins: [
    new CopyWebpackPlugin([{
        from: 'src/templates',
        to: path.resolve(__dirname, 'dist/templates'),
        toType: 'dir'
      },
      {
        from: 'src/sections',
        to: path.resolve(__dirname, 'dist/sections'),
        toType: 'dir'
      },
      {
        from: 'src/snippets',
        to: path.resolve(__dirname, 'dist/snippets'),
        toType: 'dir'
      },
      {
        from: 'src/config',
        to: path.resolve(__dirname, 'dist/config'),
        toType: 'dir'
      },
      {
        from: 'src/layout',
        to: path.resolve(__dirname, 'dist/layout'),
        toType: 'dir'
      },
      {
        from: 'src/locales',
        to: path.resolve(__dirname, 'dist/locales'),
        toType: 'dir'
      },
      {
        from: path.resolve(__dirname, 'src/assets'),
        to: path.resolve(__dirname, 'dist/assets/[name].[ext]'),
        toType: 'template'
      }
    ], {
      logLevel: 'warn',
      copyUnmodified: false
    }),
    new MiniCssExtractPlugin({
      filename: "compiled.css",
      chunkFilename: "[id].css".replace('.scss', '')
    }),
    new webpack.ProvidePlugin({
      $: "jquery",
      jQuery: "jquery"
    }),
    new BrowserSyncPlugin({
      https: true,
      port: 3000,
      proxy: 'https://' + storeURL + '?preview_theme_id=' + themeID,
      reloadDelay: 2000,
      injectChanges: true,
      notify: true,
      watch: false,
      middleware: [
        function(req, res, next) {
          // Shopify sites with redirection enabled for custom domains force redirection
          // to that domain. `?_fd=0` prevents that forwarding.
          // ?pb=0 hides the Shopify preview bar
          const prefix = req.url.indexOf('?') > -1 ? '&' : '?';
          const queryStringComponents = ['_fd=0&pb=0'];

          req.url += prefix + queryStringComponents.join('&');
          next();
        }
      ],
      files: [{
        match: ['/tmp/.theme_ready'],
        fn: function(event, file) {
          if (event === "change") {
            const bs = require('browser-sync').get('bs-webpack-plugin');
            bs.reload();
          }
        }
      }],
      snippetOptions: {
        rule: {
          match: /<\/body>/i,
          fn: function(snippet, match) {
            return snippet + match;
          }
        }
      }
    }, {
      reload: false,
      injectCss: true
    })
  ]
};
/* eslint-enable */
