var Site = require('dw/system/Site');
var System = require('dw/system/System');
var logger = require('dw/system/Logger').getLogger('alma');
var pkg = require('../../../package.json');
var almaProductHelper = require('*/cartridge/scripts/helpers/almaProductHelper');

/**
 * Builds SFCC current version.
 * @returns {string} current version.
 */
function getSfccVersion() {
    var sfccMajor = Math.trunc(System.getCompatibilityMode() / 100);
    var sfccMinor = (System.getCompatibilityMode() % 100) / 10;
    return sfccMajor + '.' + sfccMinor;
}

/**
 * Return current Api key
 * @returns {string} current api key
 */
function getApiKey() {
    return Site.getCurrent().getCustomPreferenceValue('ALMA_APIKey');
}

/**
 * Adds common headers to request
 * @param {dw.svc.Service} service - current service instance
 * @returns {dw.svc.Service} service
 */
function addHeaders(service) {
    var apiKey = getApiKey();
    if (!apiKey) {
        logger.error('Alma api key is not configured');
        return service;
    }

    service.addHeader('Authorization', 'Alma-Auth ' + apiKey);
    service.addHeader('Content-Type', 'application/json');
    service.addHeader('User-Agent', 'SFCC/' + getSfccVersion() + '; Alma for SFCC/' + pkg.version);

    return service;
}

/**
 * Gets alma url from site preferences
 * @param {string} path url suffix (optional)
 * @returns {string} alma service url
 */
function getUrl(path) {
    if (typeof path === 'undefined') {
        path = '';
    }

    var url = Site.getCurrent().getCustomPreferenceValue('ALMA_APIUrl') + path;

    if (!url) {
        logger.error('Alma URL is not configured');
        return '';
    }

    return url;
}

/**
 * Returns is Alma Enable
 * @returns {boolean} true or false
 */
function isAlmaEnable() {
    return Site.getCurrent().getCustomPreferenceValue('isAlmaEnable');
}

/**
 * Get merchant id from customer site preferences
 * @returns {string} json as string
 */
function getMerchantId() {
    return Site.getCurrent().getCustomPreferenceValue('ALMA_Merchant_Id');
}

/**
 * Returns is Alma On shipment Enable
 * @returns {boolean} true or false
 */
function isAlmaOnShipment() {
    return Site.getCurrent().getCustomPreferenceValue('ALMA_On_Shipment_Payment');
}

/**
 * Get mode
 * @returns {string} LIVE|TEST
 */
function getMode() {
    var urlTest = getUrl().split('sandbox');
    return urlTest.length === 1 ? 'LIVE' : 'TEST';
}

/**
 * Get customer data for init payment
 * @param {Object} profile customer profile
 * @param {string} customerEmail customer email
 * @param {Object} shippingAddress shipping address
 * @returns {Object} customer data
 */
function formatCustomerData(profile, customerEmail, shippingAddress) {
    if (profile) {
        var phone = profile.phoneMobile ? profile.phoneMobile : profile.phoneHome;
        return {
            first_name: profile.firstName,
            last_name: profile.lastName,
            phone: phone,
            email: profile.email
        };
    }
    return {
        first_name: shippingAddress.first_name,
        last_name: shippingAddress.last_name,
        email: customerEmail,
        phone: shippingAddress.phone
    };
}

/**
 * Return current Locale
 * @param {dw.system.Request} req the controller request
 * @returns {string} current locale
 */
function getLocale(req) {
    var Locale = require('dw/util/Locale');

    return Locale.getLocale(req.locale.id).toString();
}

/**
 * Check if the product’s category is excluded
 * @param {array} productIds product id
 * @return {boolean} return a boolean
 */
function haveExcludedCategory(productIds) {
    var ProductMgr = require('dw/catalog/ProductMgr');
    var categoriesID = [];

    productIds.forEach(function (productId) {
        var product = ProductMgr.getProduct(productId);

        if (product.isMaster()) {
            product.getAllCategories().toArray().forEach(function (category) {
                categoriesID.push(category.getID());
            });
        } else {
            product.getMasterProduct().getAllCategories().toArray().forEach(function (category) {
                categoriesID.push(category.getID());
            });
        }
    });

    var categoriesExcluded = [];

    if (Site.getCurrent().getCustomPreferenceValue('categoryExclusion')) {
        categoriesExcluded = Site.getCurrent().getCustomPreferenceValue('categoryExclusion').trim().split(' | ');
    }

    var haveExcludedCategoryReturn = false;

    categoriesExcluded.forEach(function (categoryExcluded) {
        if (categoriesID.includes(categoryExcluded)) {
            haveExcludedCategoryReturn = true;
        }
    });

    return haveExcludedCategoryReturn;
}
/**
 * Get the full url for a page
 * @param {Object} product product
 * @param {string} locale locale
 * @returns {string} url
 */
function getFullPageUrl(product, locale) {
    return 'https://' + Site.getCurrent().getHttpsHostName() + '/s/' + Site.getCurrent().getName() + '/' + product.getPageURL() + '/' + almaProductHelper.getProductId(product) + '.html?lang=' + locale;
}

/**
 * Get categories for a product
 * @param {Object} product product
 * @returns {array} categories
 */
function getProductCategories(product) {
    var categories = [];

    almaProductHelper.getProductCategories(product).forEach(function (category) {
        if (!categories.includes(category.getID())) {
            categories.push(category.getID());
        }
    });

    return categories;
}

/**
 * Get fomated item for a product line
 * @param {Object} product product
 * @param {Object} productLine product line
 * @param {string} locale locale
 * @returns {Object} item
 */
function formatItem(product, productLine, locale) {
    return {
        sku: product.getID(),
        title: product.getName(),
        quantity: productLine.getQuantityValue(),
        unit_price: parseInt(product.getPriceModel().getPrice() * 100, 10),
        line_price: parseInt(productLine.getProratedPrice() * 100, 10),
        categories: getProductCategories(product),
        url: getFullPageUrl(product, locale),
        picture_url: product.getImage('large').getHttpsURL().toString(),
        requires_shipping: !!productLine.getShipment()
    };
}

module.exports = {
    addHeaders: addHeaders,
    formatCustomerData: formatCustomerData,
    getLocale: getLocale,
    getMerchantId: getMerchantId,
    getMode: getMode,
    getUrl: getUrl,
    isAlmaEnable: isAlmaEnable,
    isAlmaOnShipment: isAlmaOnShipment,
    getSfccVersion: getSfccVersion,
    haveExcludedCategory: haveExcludedCategory,
    formatItem: formatItem,
    getApiKey: getApiKey
};
