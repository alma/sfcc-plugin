var Site = require('dw/system/Site');

/**
 * return the deferred capture activation field value
 * @return {bool} the field value
 *
*/
function isDeferredCaptureEnable() {
    return Site.getCurrent().getCustomPreferenceValue('ALMA_Deferred_Capture_Activation');
}

/**
 * Returns true if the merchant want in-page payment
 * @returns {boolean} if we can use inpage
 */
function isInpageActivated() {
    return Site.getCurrent().getCustomPreferenceValue('ALMA_Inpage_Payment');
}

/**
 * Return amount for partial capture
 * @return {number} the amount value
 */
function getPartialCaptureAmount() {
    return Site.getCurrent().getCustomPreferenceValue('ALMA_Deferred_Capture_Partial_Amount');
}

module.exports = {
    isDeferredCaptureEnable: isDeferredCaptureEnable,
    isInpageActivated: isInpageActivated,
    getPartialCaptureAmount: getPartialCaptureAmount
};
