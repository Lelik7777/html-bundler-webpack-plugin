(self["webpackChunk"] = self["webpackChunk"] || []).push([["scripts-src_assets_js_main-b_js"],{

/***/ "./src/assets/js/main-b.js":
/*!*********************************!*\
  !*** ./src/assets/js/main-b.js ***!
  \*********************************/
/***/ ((__unused_webpack_module, __unused_webpack_exports, __webpack_require__) => {

const { lorem, libA, libB } = __webpack_require__(/*! @test-fixtures/js */ "../../../node_modules/@test-fixtures/js/src/fixture-script.js");
const modB = __webpack_require__(/*! ./module-b */ "./src/assets/js/module-b.js");
const modC = __webpack_require__(/*! ./module-c */ "./src/assets/js/module-c.js");

console.log('>> main-b:');
console.log(' - B: ', modB);
console.log(' - C: ', modC);
console.log('Lorem: ', lorem.getTitle());


/***/ }),

/***/ "./src/assets/js/module-b.js":
/*!***********************************!*\
  !*** ./src/assets/js/module-b.js ***!
  \***********************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

const lib = __webpack_require__(/*! ./lib */ "./src/assets/js/lib.js");
const value = lib.methodB();

module.exports = value;

/***/ })

}]);