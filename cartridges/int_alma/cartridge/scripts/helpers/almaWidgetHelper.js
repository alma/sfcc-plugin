var Site = require('dw/system/Site');
var almaHelpers = require('*/cartridge/scripts/helpers/almaHelpers');
var utils = require('*/cartridge/scripts/helpers/almaUtilsHelper');
var some = utils.some;
var filter = utils.filter;

/**
 * Returns is Alma widget Enable in cart
 * @returns {boolean} true or false
 */
function isCartWidgetEnable() {
    return Site.getCurrent().getCustomPreferenceValue('isWidgetEnable');
}

/**
 * Returns is Alma widget Enable in product detail
 * @returns {boolean} true or false
 */
function isProductWidgetEnable() {
    return Site.getCurrent().getCustomPreferenceValue('isProductWidgetEnable');
}

/**
 * Returns cart selector
 * @returns {string} the cart selector
 */
function cartSelector() {
    return Site.getCurrent().getCustomPreferenceValue('cartSelector');
}

/**
 * Returns product selector
 * @returns {string} the product selector
 */
function productSelector() {
    return Site.getCurrent().getCustomPreferenceValue('productSelector');
}

/**
 * Get Widget container selector
 * @param {string} pageType - 'cart'|'product'
 * @returns {string} the widget selector
 */
function getSelector(pageType) {
    var selectors = [
        { pageType: 'cart', getter: cartSelector },
        { pageType: 'product', getter: productSelector }
    ];

    var result = filter(selectors, function (selector) {
        return selector.pageType === pageType;
    });
    if (result.length > 0) {
        return result[0].getter();
    }

    // use default if nothing match
    return '#alma-badge';
}

/**
 * Returns is Alma widget Enable
 * @param {string} pageType - 'cart'|'product'
 * @returns {boolean} true or false
 */
function isWidgetEnabled(pageType) {
    // Only display widget on site that can use EUR
    if (Site.getCurrent().getAllowedCurrencies().indexOf('EUR') === -1) {
        return false;
    }

    var displayWidget = [
        { pageType: 'cart', predicate: isCartWidgetEnable },
        { pageType: 'product', predicate: isProductWidgetEnable }
    ];

    return some(displayWidget, function (option) {
        return option.pageType === pageType && option.predicate();
    });
}

/**
 * Format data to be returned by a controller whishing to have a widget in his view
 * @param {Object} res - res given to the controller
 * @param {string} pageType - cart|product
 * @param {string} url - data_url
 * @returns {Object} the view data, given to frontend
 */
function getViewData(res, pageType, url) {
    var URLUtils = require('dw/web/URLUtils');

    return Object.assign(res.getViewData(), {
        mode: almaHelpers.getMode(),
        merchantId: almaHelpers.getMerchantId(),
        isAlmaEnable: almaHelpers.isAlmaEnable(),
        isWidgetEnabled: isWidgetEnabled(pageType),
        selector: getSelector(pageType),
        data_url: URLUtils.http(url).toString()
    });
}

/**
 * Format data to fit Alma Widget
 * @param {Object} plan any alma plan
 * @returns {array} a plan object understandable for Alma widget
 * https://github.com/alma/widgets/blob/master/documentation.md
 */
function formatForAlmaWidget(plan) {
    return {
        installmentsCount: plan.installments_count,
        minAmount: plan.min_purchase_amount,
        maxAmount: plan.max_purchase_amount,
        deferredDays: plan.deferred_days,
        deferredMonths: 0 // this field is deprecated
    };
}

module.exports = {
    getViewData: getViewData,
    isWidgetEnabled: isWidgetEnabled,
    formatForAlmaWidget: formatForAlmaWidget
};
