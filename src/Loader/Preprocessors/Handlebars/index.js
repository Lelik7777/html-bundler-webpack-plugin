const path = require('path');
const Dependency = require('../../Dependency');
const { loadModule, readDirRecursiveSync } = require('../../../Common/FileUtils');
const { isWin, pathToPosix } = require('../../../Common/Helpers');

const preprocessor = ({ fs, rootContext, options }) => {
  const Handlebars = loadModule('handlebars');
  const extensions = ['.html', '.hbs', '.handlebars'];
  const includeFiles = [/\.(html|hbs|handlebars)$/i];
  const root = options?.root || rootContext;
  let views = options?.views || rootContext;
  let helpers = {};
  let partials = {};

  /**
   * Read files in the directories.
   *
   * @param {Array<string>} dirs The directories in which to read the list of files.
   * @param {Array<RegExp>|undefined} includes The filter to include only files matching RegExps.
   *  If the value is undefined, ignore the filter.
   * @return {{}}
   */
  const getEntries = (dirs, includes = undefined) => {
    const result = {};

    for (let dir of dirs) {
      if (!path.isAbsolute(dir)) {
        dir = path.join(rootContext, dir);
      }
      const files = readDirRecursiveSync(dir, { fs, includes });

      files.forEach((file) => {
        const relativeFile = path.relative(dir, file);
        let id = relativeFile.slice(0, relativeFile.lastIndexOf('.'));
        if (isWin) id = pathToPosix(id);
        result[id] = file;
      });

      // watch changes in the directory (add/remove a file)
      Dependency.addDir(dir);
    }

    return result;
  };

  /**
   * Get actual partials.
   *
   * @param {Array<string>|{}} options The partials option.
   * @return {{}}
   */
  const getPartials = (options) => {
    return Array.isArray(options)
      ? // read partial files
        getEntries(options, includeFiles)
      : // object of partial name => absolute path to partial file
        options;
  };

  /**
   * Get actual helpers.
   *
   * @param {Array<string>|{}} options The helpers option.
   * @return {{}}
   */
  const getHelpers = (options) => {
    return Array.isArray(options)
      ? // read helper files
        getEntries(options, [/\.(js)$/])
      : // object of helper name => absolute path to helper file
        options;
  };

  /**
   * Update partials after changes in watch/serve mode.
   */
  const updatePartials = () => {
    if (!options.partials) return;

    const actualPartials = getPartials(options.partials);
    const oldNames = Object.keys(partials);
    const newNames = Object.keys(actualPartials);
    const outdatedPartialsNames = oldNames.filter((name) => !newNames.includes(name));

    // remove deleted/renamed partials
    outdatedPartialsNames.forEach((name) => {
      Dependency.removeFile(partials[name]);
      Handlebars.unregisterPartial(name);
    });

    partials = actualPartials;

    // update content of actual partials
    for (const partial in partials) {
      const partialFile = partials[partial];

      // watch changes in a file (change/rename)
      Dependency.addFile(partialFile);

      if (!fs.existsSync(partialFile)) {
        throw new Error(`Could not find the partial '${partialFile}'`);
      }

      const template = fs.readFileSync(partialFile, 'utf8');
      Handlebars.registerPartial(partial, template);
    }
  };

  /**
   * Update helpers after changes in watch/serve mode.
   */
  const updateHelpers = () => {
    if (!options.helpers || !Array.isArray(options.helpers)) return;

    const actualHelpers = getHelpers(options.helpers);
    const oldNames = Object.keys(helpers);
    const newNames = Object.keys(actualHelpers);
    const outdatedHelperNames = oldNames.filter((name) => !newNames.includes(name));

    // remove deleted/renamed helpers
    outdatedHelperNames.forEach((name) => {
      Dependency.removeFile(helpers[name]);
      Handlebars.unregisterHelper(name);
    });

    helpers = actualHelpers;

    for (const helperName in helpers) {
      const helperFile = helpers[helperName];

      // watch changes in a file (change/rename)
      Dependency.addFile(helperFile);

      if (!fs.existsSync(helperFile)) {
        throw new Error(`Could not find the helper '${helperFile}'`);
      }

      const helper = require(helperFile);
      Handlebars.registerHelper(helperName, helper);
    }
  };

  // build-in helpers
  const buildInHelpers = {
    include: require('./helpers/include')({
      fs,
      Handlebars,
      root,
      views: Array.isArray(views) ? views : [views],
      extensions,
    }),
  };
  for (const helper in buildInHelpers) {
    Handlebars.registerHelper(helper, buildInHelpers[helper]);
  }

  if (options.helpers) {
    if (Array.isArray(options.helpers)) {
      updateHelpers();
    } else {
      // object of helper name => absolute path to helper file
      helpers = options.helpers;
      for (const helper in helpers) {
        Handlebars.registerHelper(helper, helpers[helper]);
      }
    }
  }

  if (options.partials) {
    updatePartials();
  }

  return {
    /**
     * Called to render each template page
     * @param {string} template The template content.
     * @param {string} resourcePath The request of template.
     * @param {object} data The data passed into template.
     * @return {string}
     */
    render: (template, { resourcePath, data = {} }) => Handlebars.compile(template, options)(data),

    /**
     * Called before each new compilation after changes, in the serve/watch mode.
     */
    watch: () => {
      updateHelpers();
      updatePartials();
    },
  };
};

module.exports = preprocessor;
