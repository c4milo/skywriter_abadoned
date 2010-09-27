(function() {
TIKI_PREAMBLE
tiki.register('TIKI_PACKAGE_ID', {
"name": "tiki",
"version": "TIKI_VERSION"
});

tiki.module('TIKI_PACKAGE_ID:tiki', function(require, exports, module) {
TIKI_BODY
});
TIKI_POSTAMBLE

skywriter.tiki = tiki;
})();