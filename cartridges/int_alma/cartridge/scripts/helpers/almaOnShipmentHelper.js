/**
 * Returns true if 'On shipment' payment is Enabled
 * @param  {number} installmentsCount number of installments
 * @param  {number} deferredDays (optional) number of days before payment
 * @returns {boolean} true or false
 */
function isOnShipmentPaymentEnabled(installmentsCount, deferredDays) {
    var Site = require('dw/system/Site');
    deferredDays = (typeof deferredDays !== 'undefined') ? deferredDays : 0;

    var getAllowedPlans = require('*/cartridge/scripts/helpers/almaPlanHelper').getAllowedPlans;
    var find = require('*/cartridge/scripts/helpers/almaUtilsHelper').find;

    var plans = getAllowedPlans();
    var requestedPlan = find(plans, function (plan) {
        return plan.installments_count === parseInt(installmentsCount, 10) && plan.deferred_days === parseInt(deferredDays, 10);
    });

    return Site.getCurrent()
        .getCustomPreferenceValue('ALMA_On_Shipment_Payment') && requestedPlan !== null && requestedPlan.deferred_trigger_limit_days !== null;
}

module.exports = {
    isOnShipmentPaymentEnabled: isOnShipmentPaymentEnabled
};
