// Please check all available configurations and rules
// at https://www.npmjs.com/package/isml-linter.

var config = {
    enableCache: true,
    ignore: [
        'cartridges/int_alma/cartridge/templates/default/alma/cartWidget.isml',
        'cartridges/int_alma/cartridge/templates/default/alma/widget.isml'
    ],
    rules: {
        'no-space-only-lines': {},
        'no-tabs': {},
        'no-trailing-spaces': {}
    }
};

module.exports = config;
