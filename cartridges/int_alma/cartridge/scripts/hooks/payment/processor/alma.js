var Resource = require('dw/web/Resource');
var Transaction = require('dw/system/Transaction');
var OrderMgr = require('dw/order/OrderMgr');
var PaymentMgr = require('dw/order/PaymentMgr');
var collections = require('*/cartridge/scripts/util/collections');

/**
 * Hook for submit payment
 * @param {dw.order.Basket} basket - Current users basket
 * @param {Object} paymentInformation - the payment information
 * @param {Object} paymentMethodID - unused
 * @param {Object} contactInfoFields - unused
 * @return {Object} an object that contains error information
 */
function Handle(basket, paymentInformation, paymentMethodID, contactInfoFields) { // eslint-disable-line no-unused-vars
    var currentBasket = basket;
    var errors = [];
    var error = false;
    var almaRedirect;
    var COHelpers = require('*/cartridge/scripts/checkout/checkoutHelpers');

    Transaction.wrap(function () {
        var paymentInstruments = currentBasket.getPaymentInstruments('ALMA');
        var paymentProcessor = PaymentMgr.getPaymentMethod('ALMA').paymentProcessor;

        collections.forEach(paymentInstruments, function (item) {
            if (item.paymentMethod !== 'GIFT_CERTIFICATE') {
                currentBasket.removePaymentInstrument(item);
            }
        });

        var paymentInstrument = currentBasket.createPaymentInstrument('ALMA', currentBasket.totalGrossPrice);

        paymentInstrument.paymentTransaction.setPaymentProcessor(paymentProcessor);
    });

    // Creates a new order.
    var order = COHelpers.createOrder(currentBasket);
    if (!order) error = true;

    if (error) {
        // reopen basket if possible
        Transaction.wrap(function () {
            OrderMgr.failOrder(order, true);
        });
    } else {
        Transaction.wrap(function () {
            order.custom.ALMA_ResponseDetails = 'Pay on shipment';
        });
    }

    return {
        fieldErrors: [], serverErrors: errors, error: error, urlRedirect: almaRedirect
    };
}

/**
 * default hook if no payment processor is supported
 * @param {number} orderNumber - The current order's number
 * @param {dw.order.PaymentInstrument} paymentInstrument - The payment instrument to authorize
 * @param {dw.order.PaymentProcessor} paymentProcessor - The payment processor of the current
 *      payment method
 * @return {Object} an object that contains error information
 */
function Authorize(orderNumber, paymentInstrument, paymentProcessor) {
    var serverErrors = [];
    var fieldErrors = {};
    var error = false;

    try {
        Transaction.wrap(function () {
            paymentInstrument.paymentTransaction.setTransactionID(orderNumber);
            paymentInstrument.paymentTransaction.setPaymentProcessor(paymentProcessor);
        });
    } catch (e) {
        error = true;
        serverErrors.push(
            Resource.msg('error.technical Error message: ' + e.toString(), 'checkout', null)
        );
    }

    return { fieldErrors: fieldErrors, serverErrors: serverErrors, error: error };
}

exports.Handle = Handle;
exports.Authorize = Authorize;
