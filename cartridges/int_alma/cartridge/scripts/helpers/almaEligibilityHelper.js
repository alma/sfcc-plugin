var logger = require('dw/system/Logger').getLogger('alma');
var formatAddress = require('*/cartridge/scripts/helpers/almaAddressHelper').formatAddress;

/**
 * Calls /v2/payments/eligibility and check availability on payment methods
 * @param  {Object} param the body to be given to Eligibility endpoint
 * @returns {array} plans
 */
function callEligibility(param) {
    var service = require('*/cartridge/scripts/services/alma');
    var eligibilityService = service.checkEligibility();

    var httpResult = eligibilityService.call(param);

    if (httpResult.msg === 'OK') {
        var rawResponse = httpResult.getObject().text;
        return JSON.parse(rawResponse);
    }

    var apiErrorContext = {
        HTTP_Result_Message: httpResult.msg
    };
    // Call to API failed, then we cant provide any alma payment method
    logger.error('Could not reach API. There is an issue with Alma, please contact Alma to fix this. | {0}', [JSON.stringify(apiErrorContext)]);
    return [];
}

/**
 * Get eligibility params for a given set of plan, a locale and a basket
 * @param  {Object} plansForEligibility Alma plans
 * @param {string} locale e.g. 'fr_FR'
 * @param {dw.order.Basket} currentBasket current basket
 * @param {bool} isDeferredCaptureEnabled deferred capture is enabled
 * @returns {array} of eligibility plan Object
 */
function getParams(plansForEligibility, locale, currentBasket, isDeferredCaptureEnabled) {
    if (currentBasket === null) {
        return [];
    }
    var purchaseAmount = Math.round(currentBasket.totalGrossPrice.multiply(100).value);
    var billingAddress = formatAddress(currentBasket.getBillingAddress(), currentBasket.getCustomerEmail());
    var shippingAddress = formatAddress(
        currentBasket.getDefaultShipment().shippingAddress,
        currentBasket.getCustomerEmail()
    );

    var params = {
        purchase_amount: purchaseAmount,
        queries: plansForEligibility,
        locale: locale,
        billing_address: billingAddress,
        shipping_address: shippingAddress,
        capture_method: 'automatic'
    };
    if (isDeferredCaptureEnabled) {
        params.capture_method = 'manual';
    }
    return params;
}

/**
 * Get eligibility for a given set of plan, a locale and a basket
 * @param  {Object} plansForEligibility Alma plans
 * @param {string} locale e.g. 'fr_FR'
 * @param {dw.order.Basket} currentBasket current basket
 * @param {bool} isDeferredCaptureEnabled deferred capture is enabled
 * @returns {array} of eligibility plan Object
 */
function getEligibility(plansForEligibility, locale, currentBasket, isDeferredCaptureEnabled) {
    var params = getParams(plansForEligibility, locale, currentBasket, isDeferredCaptureEnabled);
    return callEligibility(params);
}

module.exports = {
    getEligibility: getEligibility,
    getParams: getParams
};
