const path = require('path');
const Preprocessor = require('./Preprocessor');
const PluginService = require('../Plugin/PluginService');
const { isWin, pathToPosix } = require('../Common/Helpers');
const { watchPathsException } = require('./Messages/Exeptions');

/**
 * @typedef OptionSources
 * @property {string} tag
 * @property {Array<string>?} attributes
 * @property {Function?} filter
 */

class Options {
  /** The file system used by Webpack */
  static fileSystem = null;
  static #watchFiles = {};
  static #watch;
  static #webpackOptions;
  static #options;
  static #rootContext;
  static #resourcePath;

  static init(loaderContext) {
    const { loaderIndex, rootContext, resourcePath } = loaderContext;
    const loaderObject = loaderContext.loaders[loaderIndex];
    const loaderId = loaderObject.path + loaderObject.query;
    let options = PluginService.getLoaderCache(loaderId);

    this.fileSystem = loaderContext.fs.fileSystem;
    this.#webpackOptions = loaderContext._compiler.options || {};
    this.#watch = PluginService.isWatchMode();
    this.#rootContext = rootContext;
    this.#resourcePath = resourcePath;

    if (!options) {
      options = { ...PluginService.getLoaderOptions(), ...(loaderContext.getOptions() || {}) };

      // assets root path used for resolving files specified in attributes (`sources` option)
      // allow both 'root' and 'basedir' option name for compatibility
      const basedir = options.root || options.basedir || false;
      options.basedir = basedir && basedir.slice(-1) !== path.sep ? basedir + path.sep : basedir;

      PluginService.setLoaderCache(loaderId, options);
    }

    // merge plugin and loader data, the plugin data property overrides the same loader data property
    const data = { ...options.data, ...(loaderContext.entryData || {}) };
    if (Object.keys(data).length > 0) loaderObject.data = data;

    Preprocessor.init({ fileSystem: this.fileSystem, rootContext, watch: this.#watch });
    if (!Preprocessor.isReady(options.preprocessor)) {
      options.preprocessor = Preprocessor.factory(options.preprocessor, options.preprocessorOptions);
    }

    this.#options = options;

    // clean loaderContext of artifacts
    if (loaderContext.entryData != null) delete loaderContext.entryData;

    // defaults, cacheable is true, the loader option is not documented in readme, use it only for debugging
    if (loaderContext.cacheable != null) loaderContext.cacheable(options?.cacheable !== false);

    if (this.#watch) this.#initWatchFiles();
  }

  /**
   * Returns original loader options.
   *
   * @return {{}}
   */
  static get() {
    return this.#options;
  }

  /**
   * Returns the root directory for the paths in template starting with `/`.
   * @return {string|false}
   */
  static getBasedir() {
    return this.#options.basedir;
  }

  /**
   * Returns the list of tags and attributes where source files should be resolved.
   *
   * @return {Array<OptionSources>|false}
   */
  static getSources = () => {
    const { sources } = this.#options;

    if (sources === false) return false;

    // default tags and attributes for resolving resources
    const defaultSources = [
      { tag: 'link', attributes: ['href', 'imagesrcset'] }, // 'imagesrcset' if rel="preload" and as="image"
      { tag: 'script', attributes: ['src'] },
      { tag: 'img', attributes: ['src', 'srcset'] },
      { tag: 'image', attributes: ['href', 'xlink:href'] }, // <svg><image href="image.png"></image></svg>
      { tag: 'use', attributes: ['href', 'xlink:href'] }, // <svg><use href="icons.svg#home"></use></svg>
      { tag: 'input', attributes: ['src'] }, // type="image"
      { tag: 'source', attributes: ['src', 'srcset'] },
      { tag: 'audio', attributes: ['src'] },
      { tag: 'track', attributes: ['src'] },
      { tag: 'video', attributes: ['src', 'poster'] },
      { tag: 'object', attributes: ['data'] },
    ];

    if (!Array.isArray(sources)) return defaultSources;

    for (const item of sources) {
      const source = defaultSources.find(({ tag }) => tag === item.tag);
      if (source) {
        if (item.attributes) {
          for (let attr of item.attributes) {
            // add only unique attributes
            if (source.attributes.indexOf(attr) < 0) source.attributes.push(attr);
          }
        }
        if (typeof item.filter === 'function') {
          source.filter = item.filter;
        }
      } else {
        defaultSources.push(item);
      }
    }

    return defaultSources;
  };

  /**
   * Returns preprocessor to compile a template.
   * The default preprocessor use the Eta templating engine.
   *
   * @return {null|(function(string, {data?: {}}): Promise|null)}
   */
  static getPreprocessor() {
    return Preprocessor.getPreprocessor(this.#options);
  }

  static getWatchFiles() {
    return this.#watchFiles;
  }

  static getWebpackResolve() {
    return this.#webpackOptions.resolve || {};
  }

  static #initWatchFiles() {
    const watchFiles = {
      // watch files only in the directories,
      // defaults is first-level subdirectory of a template, relative to root context
      paths: [],

      // watch only files matched to RegExps,
      // if empty then watch all files, except ignored
      files: [PluginService.getOptions().getFilterRegexp()],

      // ignore paths and files matched to RegExps
      ignore: [
        /[\\/](node_modules|dist|test)$/, // dirs
        /[\\/]\..+$/, // hidden dirs and files: .git, .idea, .gitignore, etc.
        /package(?:-lock)*\.json$/,
        /webpack\.(.+)\.js$/,
        /\.(je?pg|png|ico|gif|webp|svg|woff2?|ttf|otf|eot)$/,
      ],
    };

    const fs = this.fileSystem;
    const { paths, files, ignore } = PluginService.getOptions().getWatchFiles();
    const watchDirs = new Set([this.#autodetectWatchPath()]);
    const rootContext = this.#rootContext;

    // add to watch paths defined in options of a template engine
    let { root, views, partials } = this.#options?.preprocessorOptions || {};
    let dirs = [];

    [paths, root, views, partials].forEach((item) => {
      if (item) {
        if (typeof item === 'string') dirs.push(item);
        else if (Array.isArray(item)) dirs.push(...item);
      }
    });

    for (let dir of dirs) {
      const watchDir = path.isAbsolute(dir) ? dir : path.join(rootContext, dir);
      if (!fs.existsSync(watchDir)) {
        watchPathsException(watchDir, paths);
      }
      watchDirs.add(watchDir);
    }

    // TODO: optimize watchDirs, add only unique directory and ignore subdirectories:
    //  /project/src/views/           -- ignore subdir
    //  /project/src/views/partials/  -- ignore subdir
    //  /project/src/                 ++ OK (lowest unique root)
    //  /project/src/views/includes/  -- ignore subdir
    //  /project/templates/partials/  -- ignore subdir
    //  /project/templates/           ++ OK (lowest unique root)
    //  /project/templates/includes/  -- ignore subdir

    // set the list of unique watch directories
    watchFiles.paths = Array.from(watchDirs);

    if (files) {
      const entries = Array.isArray(files) ? files : [files];
      for (let item of entries) {
        if (item.constructor.name !== 'RegExp') {
          item = new RegExp(item);
        }
        watchFiles.files.push(item);
      }
    }

    if (ignore) {
      const entries = Array.isArray(ignore) ? ignore : [ignore];
      for (let item of entries) {
        if (item.constructor.name !== 'RegExp') {
          item = new RegExp(item);
        }
        watchFiles.ignore.push(item);
      }
    }

    this.#watchFiles = watchFiles;
  }

  /**
   * Autodetect a watch directory.
   * Defaults, it is first-level subdirectory of a template, relative to root context.
   *
   * For examples:
   * ./home.html => ./
   * ./src/home.html => ./src
   * ./src/views/home.html => ./src
   * ./app/views/home.html => ./app
   *
   * @return {string}
   * @private
   */
  static #autodetectWatchPath() {
    let watchPath = this.#rootContext;
    let filePath = path.dirname(this.#resourcePath);

    if (filePath.startsWith(this.#rootContext) && watchPath !== filePath) {
      let subdir = filePath.replace(this.#rootContext, '');
      if (isWin) subdir = pathToPosix(subdir);

      let pos = subdir.indexOf('/', 1);
      if (pos > 0) subdir = subdir.slice(0, pos);
      watchPath = path.join(this.#rootContext, subdir);
    }

    return watchPath;
  }
}

module.exports = Options;
