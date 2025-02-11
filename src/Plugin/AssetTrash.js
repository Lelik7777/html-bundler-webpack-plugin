/**
 * AssetTrash singleton.
 * Accumulate and remove junk assets from compilation.
 */
class AssetTrash {
  static trash = [];
  static commentRegexp = /^\/\*!.+\.LICENSE\.txt\s*\*\/\s*/;
  static commentFileSuffix = '.LICENSE.txt';

  /**
   * Add a junk asset file to trash.
   *
   * @param {string} file
   */
  static add(file) {
    this.trash.push(file);
  }

  /**
   * Remove all trash files from compilation.
   *
   * @param {Compilation} compilation The instance of the webpack compilation.
   */
  static clearCompilation(compilation) {
    this.trash.forEach((file) => {
      compilation.deleteAsset(file);
    });

    this.reset();
  }

  /**
   * @param {Compilation} compilation The instance of the webpack compilation.
   */
  static removeComments(compilation) {
    if (!compilation.assets) return;

    const { commentRegexp, commentFileSuffix: suffix } = this;
    const { RawSource } = compilation.compiler.webpack.sources;
    const assets = Object.keys(compilation.assets);
    const licenseFiles = assets.filter((file) => file.endsWith(suffix));

    for (let filename of licenseFiles) {
      const sourceFilename = filename.replace(suffix, '');
      const source = compilation.assets[sourceFilename].source();
      compilation.updateAsset(sourceFilename, new RawSource(source.replace(commentRegexp, '')));
      this.add(filename);
    }
  }

  /**
   * Reset settings.
   * Called before each new compilation after changes, in the serve/watch mode.
   */
  static reset() {
    this.trash.length = 0;
  }
}

module.exports = AssetTrash;
