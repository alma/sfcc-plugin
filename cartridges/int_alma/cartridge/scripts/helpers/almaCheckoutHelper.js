var Resource = require('dw/web/Resource');
var formatCurrency = require('*/cartridge/scripts/util/formatting').formatCurrency;
var isOnShipmentPaymentEnabled = require('*/cartridge/scripts/helpers/almaOnShipmentHelper').isOnShipmentPaymentEnabled;
var PaymentMgr = require('dw/order/PaymentMgr');
var almaConfigHelper = require('*/cartridge/scripts/helpers/almaConfigHelper');
var almaPaymentHelper = require('*/cartridge/scripts/helpers/almaPaymentHelper');
var almaHelpers = require('*/cartridge/scripts/helpers/almaHelpers');

var ALMA_PNX_ID = 'ALMA_PNX';
var ALMA_CREDIT_ID = 'ALMA_CREDIT';
var ALMA_DEFERRED_ID = 'ALMA_DEFERRED';
var ALMA_PAY_NOW_ID = 'ALMA_PAY_NOW';
var paymentMethodId = '';

/**
 * Build the selectorName used in isml
 * @param  {Object} plan any alma plan
 * @returns {string} the custom site preference name
 */
function getSelectorNameFromPlan(plan) {
    // ALMA_general + number of installments (p1x, p3x, p4x, ....) + by how many days is the payment defered
    return 'ALMA_general_' + plan.installments_count + '_' + plan.deferred_days;
}

/**
 * Fetch the appropriate property category for a given plan
 * @param  {Object} plan any alma plan
 * @returns {string} the property 'namespace'
 */
function getPropertyCategory(plan) {
    if (plan.installments_count > 1 && plan.deferred_days > 0) {
        return 'alma.pay.in_x_installment_after_x_days';
    }
    if (plan.installments_count === 1 && plan.deferred_days === 0) {
        return 'alma.pay.now';
    }
    if (plan.deferred_days > 0) {
        return 'alma.pay.after_x_days';
    }
    return 'alma.pay.in_x_installment';
}

/**
 * Returns the title, image and description properties for a given plan
 * @param  {Object} plan any alma plan
 * @returns {Object} with the properties translated
 */
function getPaymentCoreInfo(plan) {
    var propertyParam = plan.installments_count;
    if (plan.deferred_days > 0) {
        propertyParam = plan.deferred_days;
    }
    return {
        title: Resource.msgf(getPropertyCategory(plan), 'alma', null, propertyParam),
        img: Resource.msgf(getPropertyCategory(plan) + '.img', 'alma', null, propertyParam),
        description: Resource.msgf(getPropertyCategory(plan) + '.description', 'alma', null, propertyParam)
    };
}

/**
 * Returns the amount and rate of a credit properties for a given plan
 * @param  {Object} plan any alma plan
 * @param  {string} currencyCode e.g. 'EUR'
 * @returns {Object} with the properties translated
 */
function getCreditInfo(plan, currencyCode) {
    var costOfCredit = formatCurrency(plan.customer_total_cost_amount / 100, currencyCode);
    var purchaseAmount = formatCurrency(plan.purchaseAmount, currencyCode);
    var totalCost = formatCurrency(plan.purchaseAmount + (plan.customer_total_cost_amount / 100), currencyCode);
    var rate = Math.round(plan.annual_interest_rate / 100)
        .toString() + '.' + (plan.annual_interest_rate % 100) + '%';
    return {
        basket_cost: Resource.msgf('alma.credit.basket_cost', 'alma', null, purchaseAmount),
        amount: Resource.msgf('alma.credit.cost_of_credit', 'alma', null, costOfCredit),
        rate: Resource.msgf('alma.credit.fixed_apr', 'alma', null, rate),
        total_cost: Resource.msgf('alma.credit.total_cost', 'alma', null, totalCost)
    };
}

/**
 * Returns the payment fees for a given plan
 * @param  {Object} plan any alma plan
 * @param  {string} currencyCode e.g. 'EUR'
 * @returns {string} the message to display fees
 */
function getPaymentFees(plan, currencyCode) {
    return plan.payment_plan[0].customer_fee > 0
        ? Resource.msgf('alma.with_fee', 'alma', null, formatCurrency(plan.payment_plan[0].customer_fee / 100, currencyCode))
        : Resource.msg('alma.not_fee', 'alma', null);
}

/**
 * Returns the string needed to explain remaining installments after the first one
 * @param  {Object} plan any alma plan
 * @returns {string} containing the remaining installment to pay after the 1st one
 */
function getInstallmentCountAfterFirst(plan) {
    if (plan.installments_count > 2) {
        return ' ' + (plan.installments_count - 1) + 'x';
    }
    return '';
}

/**
 * Returns the property displaying installments before calling inpage
 * @param  {Object} plan any alma plan
 * @param  {string} currencyCode e.g. 'EUR'
 * @returns {string} the message to display for a payment option
 */
function getPaymentInstallments(plan, currencyCode) {
    // deferred payment
    if (plan.deferred_days > 0) {
        return Resource.msgf(
            getPropertyCategory(plan) + '.installments',
            'alma',
            null,
            formatCurrency(plan.payment_plan[0].purchase_amount / 100, currencyCode),
            plan.deferred_days
        );
    }

    // pay now
    if (plan.installments_count === 1 && plan.deferred_days === 0) {
        return formatCurrency(plan.payment_plan[0].purchase_amount / 100, currencyCode) + ' '
            + Resource.msgf(getPropertyCategory(plan) + '.installments', 'alma', null);
    }
    // on shipment payment
    if (isOnShipmentPaymentEnabled(plan.installments_count)) {
        return formatCurrency(plan.payment_plan[0].purchase_amount / 100, currencyCode) + ' '
            + Resource.msg(getPropertyCategory(plan) + '.installments.onshipment', 'alma', null) + ' '
            + getInstallmentCountAfterFirst(plan)
            + formatCurrency(plan.payment_plan[1].purchase_amount / 100, currencyCode);
    }
    // on deferred capture
    if (almaPaymentHelper.isAvailableForManualCapture(almaConfigHelper.isDeferredCaptureEnable(), plan.installments_count, plan.deferred_days)) {
        return formatCurrency(plan.payment_plan[0].purchase_amount / 100, currencyCode) + ' '
            + plan.payment_plan[0].localized_due_date
            + Resource.msg(getPropertyCategory(plan) + '.installments.then', 'alma', null) + ' '
            + getInstallmentCountAfterFirst(plan)
            + formatCurrency(plan.payment_plan[1].purchase_amount / 100, currencyCode);
    }
    // installment payment
    return formatCurrency(plan.payment_plan[0].purchase_amount / 100, currencyCode) + ' '
        + Resource.msg(getPropertyCategory(plan) + '.installments', 'alma', null) + ' '
        + getInstallmentCountAfterFirst(plan)
        + formatCurrency(plan.payment_plan[1].purchase_amount / 100, currencyCode);
}

/**
 * Returns All the properties needed by Checkout controller
 * @param  {Object} plan any alma plan
 * @param  {string} currencyCode e.g. 'EUR'
 * @returns {Object} with all the properties needed by frontend
 */
function getPropertiesForPlan(plan, currencyCode) {
    return Object.assign(
        getPaymentCoreInfo(plan),
        {
            fees: getPaymentFees(plan, currencyCode),
            credit: getCreditInfo(plan, currencyCode),
            payment_installments: getPaymentInstallments(plan, currencyCode)
        }
    );
}

/**
 * Return true if plan is activated
 * @param {Object} paymentMethod payment method
 * @param {Object} plan plan
 * @returns {boolean} payment method ID
 */
function planIsActivated(paymentMethod, plan) {
    var almaActivated = paymentMethod.getCustom()
        .almaActivated
        .trim()
        .split('|');

    return almaActivated.some(function (element) {
        return element.includes(plan.installments_count) || element.includes(plan.deferred_days);
    });
}

/**
 * Add payment method to plans
 * @returns {string} method payment
 * @param {Object} plan plan
 */
function getPlanPaymentMethodID(plan) {
    if (plan.installments_count < 5 && planIsActivated(PaymentMgr.getPaymentMethod(ALMA_PNX_ID), plan)) {
        paymentMethodId = ALMA_PNX_ID;
    }
    if (plan.installments_count >= 5 && planIsActivated(PaymentMgr.getPaymentMethod(ALMA_CREDIT_ID), plan)) {
        paymentMethodId = ALMA_CREDIT_ID;
    }
    if (plan.deferred_days > 0 && planIsActivated(PaymentMgr.getPaymentMethod(ALMA_DEFERRED_ID), plan)) {
        paymentMethodId = ALMA_DEFERRED_ID;
    }
    if (plan.installments_count === 1 && plan.deferred_days === 0 && planIsActivated(PaymentMgr.getPaymentMethod(ALMA_PAY_NOW_ID), plan)) {
        paymentMethodId = ALMA_PAY_NOW_ID;
    }

    return paymentMethodId;
}

/**
 * Format Alma mode data to fit in Checkout view data
 * @returns {Object} Alma mode data
 * - isTest: boolean true if Alma mode is TEST
 * - labels: object with title and description for translations
 */
function getFormattedAlmaModeData() {
    return {
        isTest: almaHelpers.getMode() === 'TEST',
        labels: {
            title: Resource.msg('alma.test.mode.warn.title', 'alma', null),
            description: Resource.msg('alma.test.mode.warn.description', 'alma', null)
        }
    };
}

/**
 * Format plan data to fit in Checkout view data
 * @param  {Object} plan any alma plan
 * @param  {string} currencyCode e.g. 'EUR'
 * @returns {array} a plan Object understandable for Eligibility
 */
function formatPlanForCheckout(plan, currencyCode) {
    var formatPlan = {};
    var ALMA_PNX = plan.installments_count < 5 && planIsActivated(PaymentMgr.getPaymentMethod(ALMA_PNX_ID), plan);
    var ALMA_CREDIT = plan.installments_count >= 5 && planIsActivated(PaymentMgr.getPaymentMethod(ALMA_CREDIT_ID), plan);
    var ALMA_DEFERRED = plan.deferred_days > 0 && planIsActivated(PaymentMgr.getPaymentMethod(ALMA_DEFERRED_ID), plan);
    var ALMA_PAY_NOW = plan.installments_count === 1 && plan.deferred_days === 0 && planIsActivated(PaymentMgr.getPaymentMethod(ALMA_PAY_NOW_ID), plan);
    if (ALMA_PNX || ALMA_CREDIT || ALMA_DEFERRED || ALMA_PAY_NOW) {
        formatPlan = {
            in_page: almaConfigHelper.isInpageActivated(),
            selector: getSelectorNameFromPlan(plan),
            installments_count: plan.installments_count,
            deferred_days: plan.deferred_days,
            purchase_amount: plan.purchase_amount,
            customer_fee: plan.customer_fee,
            payment_plan: plan.payment_plan,
            properties: getPropertiesForPlan(plan, currencyCode),
            payment_method: getPlanPaymentMethodID(plan),
            alma_mode: getFormattedAlmaModeData()
        };
    }
    return formatPlan;
}

module.exports = {
    formatPlanForCheckout: formatPlanForCheckout,
    getPlanPaymentMethodID: getPlanPaymentMethodID
};
