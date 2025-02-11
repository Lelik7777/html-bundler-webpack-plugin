const { readDirRecursiveSync } = require('../Common/FileUtils');
const PluginService = require('../Plugin/PluginService');
const AssetEntry = require('../Plugin/AssetEntry');
const Options = require('./Options');

/**
 * Dependencies in code for watching a changes.
 */
class Dependency {
  /** The file system used by Webpack */
  static fileSystem = null;
  static files = new Set();
  static directories = new Set();
  static loaderContext = null;
  static watchFiles = {};
  static #entryFiles = new Set();

  static init(loaderContext) {
    if (!PluginService.isWatchMode()) return;

    PluginService.setDependencyInstance(this);
    this.loaderContext = loaderContext;
    this.fileSystem = loaderContext.fs.fileSystem;
    this.watchFiles = Options.getWatchFiles();
    this.#entryFiles = AssetEntry.getEntryFiles();
    this.addFile = this.addFile.bind(this);

    const fs = this.fileSystem;
    const { files: includes, ignore: excludes, paths = [] } = this.watchFiles;

    for (const watchDir of paths) {
      const files = readDirRecursiveSync(watchDir, { fs, includes, excludes });
      files.forEach(this.addFile);
    }

    const customWatchFiles = Options.getCustomWatchFiles();
    if (customWatchFiles.length > 0) customWatchFiles.forEach(this.addFile);
  }

  /**
   * @param {string} dir
   */
  static addDir(dir) {
    this.directories.add(dir);
  }

  /**
   * @param {string} file
   */
  static addFile(file) {
    this.files.add(file);

    // delete the file from require.cache to reload cached file after change
    if (file in require.cache) {
      delete require.cache[file];
    }
  }

  /**
   * @param {string} file
   */
  static removeFile(file) {
    this.files.delete(file);
  }

  /**
   * Enable Webpack watching for dependencies.
   */
  static watch() {
    if (!PluginService.isWatchMode()) return;

    const { loaderContext } = this;

    for (let dir of this.directories) {
      loaderContext.addContextDependency(dir);
    }

    for (let file of this.files) {
      if (!this.#entryFiles.has(file)) {
        // the dependency already contains the current resource file,
        // add for watching only files not defined in the entry to avoid unnecessary rebuilding of all templates
        loaderContext.addDependency(file);
      }
    }
  }

  /**
   * Called when the compiler is closing or a watching compilation has stopped.
   */
  static shutdown() {
    this.files.clear();
    this.directories.clear();
  }
}

module.exports = Dependency;
