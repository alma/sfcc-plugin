var Site = require('dw/system/Site');
var logger = require('dw/system/Logger').getLogger('alma');
var almaUtilsHelpers = require('*/cartridge/scripts/helpers/almaUtilsHelper');
var almaEligibilityHelper = require('*/cartridge/scripts/helpers/almaEligibilityHelper');
var almaCheckoutHelper = require('*/cartridge/scripts/helpers/almaCheckoutHelper');
var almaWidgetHelper = require('*/cartridge/scripts/helpers/almaWidgetHelper');
var almaPaymentHelper = require('*/cartridge/scripts/helpers/almaPaymentHelper');
var almaConfigHelper = require('*/cartridge/scripts/helpers/almaConfigHelper');

var CAPTURE_METHOD = {
    automatic: 'automatic',
    manual: 'manual'
};

/**
 * Calls /me/fee-plans and fetch the available plans for the current merchant
 * @returns {array} plans
 */
function getFeePlans() {
    var plansString = Site.getCurrent().getCustomPreferenceValue('ALMA_FEE_PLANS');
    try {
        return JSON.parse(plansString);
    } catch (e) {
        logger.error('Configuration Error, please run \'npm run build:sitepref\' and import site_template.zip again. Error message: ' + e.toString());
    }
    return [];
}

/**
 * build the appropriate custom site pref name for a given plan
 * @param  {Object} plan any alma plan
 * @returns {string} site preference name
 */
function getSitePrefNameFromPlan(plan) {
    // ALMA_general + number of installments (p1x, p3x, p4x, ....) + by how many days is the payment deferred
    return 'ALMA_general_' + plan.installments_count + '_' + plan.deferred_days;
}

/**
 * Check if plan is activated by the merchant in sfcc back office
 * @param  {Object} plan any alma plan
 * @returns {boolean} true or false
 */
function checkMerchantConfig(plan) {
    var sitePref = Site.getCurrent().getCustomPreferenceValue(getSitePrefNameFromPlan(plan));
    return sitePref === true || sitePref === null;
}

/**
 * Restrict min and max amount trigger for a plan upon merchant settings sfcc back office
 * Leave Alma's setting if setting is blank
 * @param  {Object} currentPlan any alma plan
 * @returns {Object} plan any alma plan
 */
function applyMerchantConfig(currentPlan) {
    var plan = currentPlan;
    var sitePrefBase = getSitePrefNameFromPlan(plan);

    var minSitePref = Site.getCurrent().getCustomPreferenceValue(sitePrefBase + '_min');
    if (minSitePref !== null) {
        // * 100 because price is in cents
        plan.min_purchase_amount = minSitePref * 100;
    }

    var maxSitePref = Site.getCurrent().getCustomPreferenceValue(sitePrefBase + '_max');
    if (maxSitePref !== null) {
        // * 100 because price is in cents
        plan.max_purchase_amount = maxSitePref * 100;
    }

    return plan;
}

/**
 * Before calling eligibility, remove plans that doesn't fall within merchant config
 * @param  {Object} plan any alma plan
 * @param  {number} purchaseAmount order total amount
 * @returns {Object} plan any alma plan
 */
function filterWithMerchantConfig(plan, purchaseAmount) {
    return (purchaseAmount > (plan.min_display_amount / 100)) && (purchaseAmount < (plan.max_display_amount / 100));
}

/**
 * Get data to initialize widget in cart and product detail
 * @returns {array} widget data
 */
function getAllowedPlans() {
    var plans = getFeePlans();
    // only keep what's alma allows
    plans = almaUtilsHelpers.filter(plans, function (plan) {
        return plan.allowed;
    });
    // only keep what's the merchant allow
    plans = almaUtilsHelpers.filter(plans, checkMerchantConfig);

    return almaUtilsHelpers.map(plans, applyMerchantConfig);
}

/**
 * Get data to initialize widget in cart and product detail
 * @returns {array} eligible data
 */
function getPlansForWidget() {
    var plans = getAllowedPlans();

    plans = almaUtilsHelpers.map(plans, almaWidgetHelper.formatForAlmaWidget);

    return plans;
}

/**
 * Get feePlans with BO info
 * @param {Object} feePlans feePlans
 * @returns {Array} feePlans
 */
function getFeePlansBoFormat(feePlans) {
    var plans = [];
    feePlans.forEach(function (feePlan) {
        var feePlanKey = getSitePrefNameFromPlan(feePlan);
        if (Site.getCurrent()
            .getCustomPreferenceValue(feePlanKey)) {
            var plan = feePlan;
            plan.key = feePlanKey;
            plan.max_display_amount = Site.getCurrent()
                .getCustomPreferenceValue(feePlanKey + '_max') * 100;
            plan.min_display_amount = Site.getCurrent()
                .getCustomPreferenceValue(feePlanKey + '_min') * 100;
            plan.payment_method = almaCheckoutHelper.getPlanPaymentMethodID(feePlan);
            plans.push(plan);
        }
    });

    return plans;
}

/**
 * Build eligible plans
 * @param {number} purchaseAmount purchaseAmount
 * @param {Array} feePlans feePlans
 * @param {string} locale locale
 * @param {Object} currentBasket currentBasket
 * @param {array} plans plans
 * @param {bool} isDeferredCaptureEnabled deferred capture is enabled
 * @returns {Object} eligible plans
 */
function buildEligiblePlans(purchaseAmount, feePlans, locale, currentBasket, plans, isDeferredCaptureEnabled) {
    var plansEligible = almaEligibilityHelper.getEligibility(feePlans, locale, currentBasket, isDeferredCaptureEnabled);
    if (!Array.isArray(plansEligible)) {
        plansEligible = [plansEligible];
    }

    plansEligible = almaUtilsHelpers.map(plansEligible, function (planForReassignment) {
        planForReassignment.purchaseAmount = purchaseAmount;
        return almaCheckoutHelper.formatPlanForCheckout(planForReassignment, currentBasket.currencyCode);
    });

    plansEligible.forEach(function (planEligible) {
        if (typeof plans[planEligible.payment_method] === 'undefined') {
            plans[planEligible.payment_method] = {};
            logger.error('Never arrive -> planEligible.payment_method: {0}', [planEligible.payment_method]);
        }
        if (typeof plans[planEligible.payment_method][planEligible.selector] === 'undefined') {
            plans[planEligible.payment_method][planEligible.selector] = {};
            logger.error('Never arrive -> planEligible.selector: {0}', [planEligible.selector]);
        }
        plans[planEligible.payment_method][planEligible.selector].eligible = true;
        plans[planEligible.payment_method][planEligible.selector].payment_plans = planEligible.payment_plan;
        plans[planEligible.payment_method][planEligible.selector].properties = planEligible.properties;
        plans[planEligible.payment_method][planEligible.selector].in_page = planEligible.in_page;
        plans[planEligible.payment_method][planEligible.selector].alma_mode = planEligible.alma_mode;
    });

    return plans;
}

/**
 * Get plans formatted for front integration
 * @param {Object} plans plans before format
 * @returns {array} formatted plans
 */
function getFormattedPlans(plans) {
    var formattedPlans = [];
    Object.keys(plans).forEach(function (paymentMethod) {
        var paymentMethodPlans = [];
        var formattedPaymentMethod = {};
        var hasEligiblePaymentMethod = false;

        Object.keys(plans[paymentMethod]).forEach(function (keys) {
            paymentMethodPlans.push(plans[paymentMethod][keys]);
            plans[paymentMethod][keys].captureMethod = CAPTURE_METHOD.automatic;

            if (almaPaymentHelper.isAvailableForManualCapture(
                almaConfigHelper.isDeferredCaptureEnable(),
                plans[paymentMethod][keys].installments_count,
                plans[paymentMethod][keys].deferred_days
            )) {
                plans[paymentMethod][keys].captureMethod = CAPTURE_METHOD.manual;
            }

            if (!plans[paymentMethod][keys].properties) {
                plans[paymentMethod][keys].properties = {
                    title: '',
                    img: '',
                    description: '',
                    fees: '',
                    credit: {
                        basket_cost: '',
                        amount: '',
                        rate: '',
                        total_cost: ''
                    }
                };
            }
            if (plans[paymentMethod][keys].payment_plans) {
                hasEligiblePaymentMethod = true;
            }
        });

        formattedPaymentMethod.hasEligiblePaymentMethod = hasEligiblePaymentMethod;
        formattedPaymentMethod.name = paymentMethod;
        formattedPaymentMethod.plans = paymentMethodPlans;
        formattedPlans.push(formattedPaymentMethod);
    });
    return formattedPlans;
}

/**
 * Get data to initialize widget in cart and product detail
 * @param {string} locale e.g. "fr_FR"
 * @param {dw.order.Basket} currentBasket current basket
 * @param {bool} isDeferredCaptureEnabled deferred capture is enabled
 * @returns {array} eligible data
 */
function getPlansForCheckout(locale, currentBasket, isDeferredCaptureEnabled) {
    var feePlans = getFeePlans();

    feePlans = getFeePlansBoFormat(feePlans);

    var plans = {};
    feePlans.forEach(function (feePlan) {
        if (typeof plans[feePlan.payment_method] === 'undefined') {
            plans[feePlan.payment_method] = {};
        }
        plans[feePlan.payment_method][feePlan.key] = feePlan;
    });

    var purchaseAmount = currentBasket.totalGrossPrice.value;

    feePlans = almaUtilsHelpers.filter(feePlans, function (feePlan) {
        return filterWithMerchantConfig(feePlan, purchaseAmount);
    });

    plans = buildEligiblePlans(purchaseAmount, feePlans, locale, currentBasket, plans, isDeferredCaptureEnabled);

    return getFormattedPlans(plans);
}

module.exports = {
    getAllowedPlans: getAllowedPlans,
    getPlansForWidget: getPlansForWidget,
    getPlansForCheckout: getPlansForCheckout,
    getFormattedPlans: getFormattedPlans,
    CAPTURE_METHOD: CAPTURE_METHOD
};
