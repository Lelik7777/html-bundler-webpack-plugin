const ansis = require('ansis');
const { bgRed, redBright, yellow, cyan } = require('ansis/colors');
const { loaderName } = require('../config');

const loaderHeader = `\n${bgRed.whiteBright` ${loaderName} `}`;
const loaderHeaderHtml = `<span style="color:#e36049">[${loaderName}]</span>`;
let lastError = null;

class LoaderException extends Error {
  constructor(message) {
    super(message);
    this.name = 'LoaderException';
    this.message = message;
  }
}

/**
 * @param {string} message The error description.
 * @param {LoaderException|Error|string?} error The original error from catch()
 * @constructor
 */
const LoaderError = function (message, error = '') {
  if (error && error instanceof LoaderException) {
    if (error.toString() === lastError) {
      // prevent double output same error
      throw new LoaderException(lastError);
    }
    // throw original error to avoid output all nested exceptions
    lastError = error.toString();
    throw new Error(lastError);
  }
  lastError = message + `\n\n${redBright`Original Error:`}\n` + error;
  throw new LoaderException(lastError);
};

/**
 * @param {LoaderException|Error} error The original error.
 * @param {string} file The resource file.
 * @param {string} templateFile The template file.
 * @throws {Error}
 */
const resolveException = (error, file, templateFile) => {
  const message =
    `${loaderHeader} The file ${yellow`'${file}'`} can't be resolved in the template ` + cyan(templateFile);

  LoaderError(message, error);
};

/**
 * Return error string as HTML to display the error in browser by HMR.
 *
 * @param {string} error
 * @param {string} hmr
 * @returns {string}
 */
const errorToHtml = (error, hmr) => {
  let message = error.replace(/\n/g, '<br>');
  message = ansis.strip(message);
  message = message.replace(`[${loaderName}]`, loaderHeaderHtml);

  return `<!DOCTYPE html><html>
<head><script src="${hmr}"></script></head>
<body><div>${message}</div></body></html>`.replace(/\n/g, '');
};

/**
 * @param {Error} error
 * @param {string} file
 * @returns {string}
 */
const preprocessorErrorToString = (error, file) => {
  return `${loaderHeader} Preprocessor failed\nFile: ${cyan(file)}\n` + error.toString();
};

/**
 * @param {Error} error
 * @param {string} file
 * @returns {string}
 */
const compileErrorToString = (error, file) => {
  return `${loaderHeader} Template compilation failed\nFile: ${cyan(file)}\n` + error.toString();
};

/**
 * @param {Error} error
 * @param {string} file
 * @returns {string}
 */
const exportErrorToString = (error, file) => {
  return `${loaderHeader} Export of compiled template failed\nFile: ${cyan(file)}\n` + error.toString();
};

module.exports = {
  LoaderError,
  errorToHtml,
  resolveException,
  preprocessorErrorToString,
  compileErrorToString,
  exportErrorToString,
};
