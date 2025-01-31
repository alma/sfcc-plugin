var pkg = require('../../../package.json');

var CAPTURE = {
    toCapture: {
        code: 'ToCapture'
    },
    total: {
        code: 'Captured',
        description: 'Total Capture'
    },
    partial: {
        code: 'PartialCaptured',
        description: 'Partial captured'
    },
    failed: {
        code: 'Failed',
        description: 'Unable to capture'
    }
};
var MAX_INSTALLMENTS_COUNT_FOR_PNX = 4;
var DEFERRED_DAYS_FOR_PNX = 0;

/**
 * Allow to check an order status
 * @param {dw.order.Order} order the order to check
 * @param {number} status status to check
 * @returns {boolean} if the order is at the requested status
 */
function orderStatusEquals(order, status) {
    return parseInt(order.status, 10) === parseInt(status, 10);
}

/**
 * Return payment info from Alma API
 * @param {string} almaPaymentId PaymentId of an alma payment
 * @throw Error
 * @returns {Object} info from Alma API payment
 */
function getPaymentObj(almaPaymentId) {
    var service = require('*/cartridge/scripts/services/alma');

    var param = {
        method: 'GET',
        pid: almaPaymentId
    };

    var httpResult = service.getPaymentDetails()
        .call(param);
    if (httpResult.msg !== 'OK') {
        throw new Error('API error');
    }
    return JSON.parse(httpResult.getObject().text);
}

/**
 * Once Alma API return a success for the Order payment, accept the Order
 * @param {dw.order.Order} order the order to accept
 * @param {boolean} paymentStatus the payment status, should be PAYMENT_STATUS_NOTPAID if we use payment on shipment
 */
function acceptOrder(order, paymentStatus) {
    var Transaction = require('dw/system/Transaction');
    var OrderMgr = require('dw/order/OrderMgr');
    var Order = require('dw/order/Order');

    Transaction.wrap(function () {
        // if the order is still cancel, uncancel it
        if (orderStatusEquals(order, Order.ORDER_STATUS_FAILED)) {
            OrderMgr.undoFailOrder(order);
        }

        // ensure that the order need to be opened/placed
        if (!orderStatusEquals(order, Order.ORDER_STATUS_CREATED)) {
            return;
        }

        // place the order
        OrderMgr.placeOrder(order);
        order.setConfirmationStatus(Order.CONFIRMATION_STATUS_CONFIRMED);
        order.setExportStatus(Order.EXPORT_STATUS_READY);
        order.setPaymentStatus(paymentStatus);
    });
}

/**
 * Return a string to describe a payment
 * @param {Object} paymentObj the payment to describe
 * @returns {string} describing a payment
 */
function getPaymentDetails(paymentObj) {
    var isOnShipmentPaymentEnabled = require('*/cartridge/scripts/helpers/almaOnShipmentHelper').isOnShipmentPaymentEnabled;
    var Calendar = require('dw/util/Calendar');
    var StringUtils = require('dw/util/StringUtils');
    var formatCurrency = require('*/cartridge/scripts/util/formatting').formatCurrency;

    if (isOnShipmentPaymentEnabled(paymentObj.installments_count)) {
        return 'onShipment';
    }
    var payDetail = '';
    var payPlan = paymentObj.payment_plan;
    // TODO: muting no-plusplus rule until we refactor more efficiently the code to match Node >=22
    // eslint-disable-next-line no-plusplus
    for (var i = 0, l = payPlan.length; i < l; i++) {
        payDetail
            += StringUtils.formatCalendar(
                new Calendar(new Date(payPlan[i].due_date * 1000)),
                'dd/MM/yyyy'
            )
            + ': '
            + formatCurrency(payPlan[i].purchase_amount / 100, 'EUR')
            + ' '
            + payPlan[i].state
            + '  ';
    }
    return payDetail;
}

/**
 * Check if we have to launch a hook to autorize a payement processor
 *
 * @param {dw/order/Order} order the order linked with payment processor
 */
function authorizePaymentProcessor(order) {
    var PaymentMgr = require('dw/order/PaymentMgr');
    var HookMgr = require('dw/system/HookMgr');
    var forOf = require('*/cartridge/scripts/helpers/almaUtilsHelper').forOf;

    forOf(order.paymentInstruments, function (paymentInstrument) {
        if (paymentInstrument.paymentMethod === 'GIFT_CERTIFICATE') {
            var paymentProcessor = PaymentMgr.getPaymentMethod(
                paymentInstrument.paymentMethod
            ).paymentProcessor;

            HookMgr.callHook(
                'app.payment.processor.' + paymentProcessor.ID.toLowerCase(),
                'Authorize',
                order.orderNo,
                paymentInstrument,
                paymentProcessor
            );
        }
    });
}

/**
 * Allow to empty current basket
 */
function emptyCurrentBasket() {
    var forOf = require('*/cartridge/scripts/helpers/almaUtilsHelper').forOf;
    var BasketMgr = require('dw/order/BasketMgr');
    var currentBasket = BasketMgr.getCurrentBasket();

    if (currentBasket) {
        currentBasket.removeAllPaymentInstruments();
        var products = currentBasket.allProductLineItems;

        forOf(products, function (product) {
            currentBasket.removeProductLineItem(product);
        });
    }
}

/**
 * Return an OrderModel based on an Order
 * @param {dw/order/Order} order the current order
 * @param {string} localeId the local
 * @returns {OrderModel} the OrderModel
 */
function getOrderModel(order, localeId) {
    var Locale = require('dw/util/Locale');
    var OrderModel = require('*/cartridge/models/order');

    var config = {
        numberOfLineItems: '*'
    };
    var currentLocale = Locale.getLocale(localeId);

    var country = currentLocale ? currentLocale.country : 'FR';
    return new OrderModel(order, {
        config: config,
        countryCode: country,
        containerView: 'order'
    });
}

/**
 * Return an User profile based on email
 * @param {string} email the user email
 * @returns {Customer} the user profile
 */
function getUserProfile(email) {
    var CustomerMgr = require('dw/customer/CustomerMgr');
    return CustomerMgr.searchProfile('email={0}', email);
}

/**
 * Create an order from a Basket UUID
 * @param {string} UUID uuid
 * @returns {dw.order.Order} order
 */
function createOrderFromBasketUUID(UUID) {
    var PaymentMgr = require('dw/order/PaymentMgr');
    var BasketMgr = require('dw/order/BasketMgr');
    var OrderMgr = require('dw/order/OrderMgr');
    var Transaction = require('dw/system/Transaction');
    var COHelpers = require('*/cartridge/scripts/checkout/checkoutHelpers');

    // error here because don't have session
    var basket = BasketMgr.getBasket(UUID);

    Transaction.wrap(function () {
        basket.removeAllPaymentInstruments();
        var paymentProcessor = PaymentMgr.getPaymentMethod('ALMA_CREDIT').paymentProcessor;
        var paymentInstrument = basket.createPaymentInstrument(
            'ALMA',
            basket.totalGrossPrice
        );

        paymentInstrument.paymentTransaction.setPaymentProcessor(
            paymentProcessor
        );
    });
    var order = COHelpers.createOrder(basket);
    Transaction.wrap(function () {
        OrderMgr.failOrder(order, true);
    });
    return order;
}

/**
 * create an order from a Basket
 * @param {string} almaPaymentMethod payment metyhod ID
 * @returns {dw.order.Order} the created order
 * @throws Error
 */
function createOrderFromBasket(almaPaymentMethod) {
    var PaymentMgr = require('dw/order/PaymentMgr');
    var BasketMgr = require('dw/order/BasketMgr');
    var OrderMgr = require('dw/order/OrderMgr');
    var Transaction = require('dw/system/Transaction');
    var COHelpers = require('*/cartridge/scripts/checkout/checkoutHelpers');

    var currentBasket = BasketMgr.getCurrentBasket();

    if (currentBasket == null) {
        throw new Error('Current basket is null');
    }

    // If almaPaymentMethod doesn't exist force to 'ALMA_PNX' to get paymentMethod
    if (!almaPaymentMethod) {
        almaPaymentMethod = 'ALMA_PNX';
    }

    Transaction.wrap(function () {
        currentBasket.removeAllPaymentInstruments();

        // If almaPaymentMethod doesn't exist force to 'ALMA_PNX' to get paymentMethod
        if (!almaPaymentMethod) {
            almaPaymentMethod = 'ALMA_PNX';
        }
        var paymentMethod = PaymentMgr.getPaymentMethod(almaPaymentMethod);

        if (!paymentMethod) {
            var paymentMethodErrorContext = {
                Alma_Payment_Method: almaPaymentMethod
            };
            var Logger = require('dw/system/Logger')
                .getLogger('alma');
            Logger.error('Unable to process payment: payment method not found. | {0}', [JSON.stringify(paymentMethodErrorContext)]);
            throw new Error('Unable to process payment: payment method not found');
        }

        var paymentProcessor = paymentMethod.paymentProcessor;
        var paymentInstrument = currentBasket.createPaymentInstrument(
            'ALMA',
            currentBasket.totalGrossPrice
        );

        paymentInstrument.paymentTransaction.setPaymentProcessor(
            paymentProcessor
        );
    });
    var order = COHelpers.createOrder(currentBasket);
    Transaction.wrap(function () {
        OrderMgr.failOrder(order, true);
    });
    return order;
}

/**
 * Calls the create payment endpoint
 * @param {Object} param to give to the payment endpoint
 * @returns {Object} api response
 */
function createPayment(param) {
    var service = require('*/cartridge/scripts/services/alma');
    var httpResult = service.createPayment()
        .call(param);

    if (httpResult.msg !== 'OK') {
        var e = new Error('API error : ' + httpResult.status);
        e.name = 'create_payment_error';
        throw e;
    }
    return JSON.parse(httpResult.getObject().text);
}

/**
 * Calls the capture payment endpoint
 * @param {Object} params to give to the payment endpoint
 * @returns {Object} api response
 * @throws Error
 */
function capturePayment(params) {
    var service = require('*/cartridge/scripts/services/alma');
    var httpResult = service.captures()
        .call(params);
    if (httpResult.status !== 'OK') {
        var e = new Error('API error : ' + httpResult.status);
        e.name = 'capture_payment_error';
        throw e;
    }
    return JSON.parse(httpResult.getObject().text);
}
/**
 * Calls the cancel payment endpoint
 * @param {Object} params to give to the payment endpoint
 * @returns {Object} api response
 * @throws Error
 */
function cancelAlmaPayment(params) {
    var service = require('*/cartridge/scripts/services/alma');
    var httpResult = service.cancelAlmaPayment()
        .call(params);
    if (httpResult.status !== 'OK') {
        var e = new Error('API error : ' + httpResult.status);
        e.name = 'cancel_payment_error';
        throw e;
    }
    return JSON.parse(httpResult.getObject().text);
}

/**
 * Check if manual capture is available
 * @param {boolean} isManualCaptureEnabled  manual capture is enabled
 * @param {number} installmentsCount installments count
 * @param {number} deferredDays deferred days
 * @return {boolean} is available
 */
function isAvailableForManualCapture(isManualCaptureEnabled, installmentsCount, deferredDays) {
    return isManualCaptureEnabled && installmentsCount <= MAX_INSTALLMENTS_COUNT_FOR_PNX && deferredDays <= DEFERRED_DAYS_FOR_PNX;
}

/**
 * Build the data to give to the payment endpoint
 * @param {number} installmentsCount number of installments to pay
 * @param {number} deferredDays number of days to the first payment
 * @param {string} locale the user locale
 * @param {boolean} isManualCapture for capture_method
 * @returns {Object} to give to the payment endpoint
 */
function buildPaymentData(installmentsCount, deferredDays, locale, isManualCapture) {
    var BasketMgr = require('dw/order/BasketMgr');
    var URLUtils = require('dw/web/URLUtils');
    var almaHelper = require('*/cartridge/scripts/helpers/almaHelpers');
    var almaConfigHelper = require('*/cartridge/scripts/helpers/almaConfigHelper');

    var formatAddress = require('*/cartridge/scripts/helpers/almaAddressHelper').formatAddress;
    var isOnShipmentPaymentEnabled = require('*/cartridge/scripts/helpers/almaOnShipmentHelper').isOnShipmentPaymentEnabled;
    var formatCustomerData = require('*/cartridge/scripts/helpers/almaHelpers').formatCustomerData;

    var origin = 'online';
    if (almaConfigHelper.isInpageActivated()) {
        origin = 'online_in_page';
    }

    var currentBasket = BasketMgr.getCurrentBasket();
    var isEnableOnShipment = isOnShipmentPaymentEnabled(installmentsCount);

    var paymentData = {
        payment: {
            purchase_amount: Math.round(currentBasket.totalGrossPrice.multiply(100).value),
            installments_count: parseInt(installmentsCount, 10),
            deferred_days: parseInt(deferredDays, 10),
            deferred_months: 0,
            return_url: URLUtils.http('Alma-PaymentSuccess')
                .toString(),
            ipn_callback_url: URLUtils.http('Alma-IPN')
                .toString(),
            customer_cancel_url: URLUtils.https('Alma-CustomerCancel')
                .toString(),
            locale: locale,
            origin: origin,
            shipping_address: formatAddress(currentBasket.getDefaultShipment().shippingAddress),
            billing_address: formatAddress(currentBasket.getBillingAddress()),
            deferred: isEnableOnShipment ? 'trigger' : '',
            deferred_description: isEnableOnShipment ? require('dw/web/Resource')
                .msg('alma.at_shipping', 'alma', null) : '',
            custom_data: {
                cms_name: 'SFCC',
                cms_version: almaHelper.getSfccVersion(),
                alma_plugin_version: pkg.version
            }
        },
        customer: formatCustomerData(currentBasket.getCustomer().profile, currentBasket.getCustomerEmail(), formatAddress(currentBasket.getDefaultShipment().shippingAddress))
    };

    if (isManualCapture) {
        paymentData.payment.capture_method = 'manual';
    }

    var products = currentBasket.getAllProductLineItems();
    var items = [];

    products.toArray()
        .forEach(function (productLineItem) {
            var product = productLineItem.getProduct();
            items.push(almaHelper.formatItem(product, productLineItem, locale));
        });

    paymentData.payment.cart = {
        items: items
    };

    return paymentData;
}

/**
 * Call API to potential fraud
 * @param {string} pid payment id
 * @param {string} reason reason for potential fraud
 */
function flagAsPotentialFraud(pid, reason) {
    var service = require('*/cartridge/scripts/services/alma');
    var param = {
        pid: pid,
        reason: reason
    };

    var potentialFraudService = service.potentialFraud();
    potentialFraudService.call(param);
}

/**
 *  Call API to set merchant_reference in order
 * @param {string} pid payment id
 * @param {Order} order to give to the payment endpoint
 */
function setOrderMerchantReference(pid, order) {
    var service = require('*/cartridge/scripts/services/alma');

    var param = {
        pid: pid,
        order: {
            merchant_reference: order.getOrderNo()
        }
    };

    var setOrderMerchantReferenceAPI = service.setOrderMerchantReferenceAPI();
    setOrderMerchantReferenceAPI.call(param);
}

/**
 * Check if a payment is expired
 * @param {Object} paymentObj payment object
 * @return {boolean} payment is expired
 */
function isPaymentExpired(paymentObj) {
    return paymentObj.expired_at !== null;
}

/**
 * Check if an authorization for a payment is expired
 * @param {Object} paymentObj payment object
 * @return {boolean} payment’s authorization is expired
 */
function isPaymentAuthorizationExpired(paymentObj) {
    var timeElapsed = Date.now();
    var today = new Date(timeElapsed);
    var authorizationExpiresAtDate = new Date(paymentObj.authorization_expires_at);
    return authorizationExpiresAtDate.getTime() < today.getTime();
}

module.exports = {
    orderStatusEquals: orderStatusEquals,
    getPaymentObj: getPaymentObj,
    acceptOrder: acceptOrder,
    getPaymentDetails: getPaymentDetails,
    authorizePaymentProcessor: authorizePaymentProcessor,
    emptyCurrentBasket: emptyCurrentBasket,
    getOrderModel: getOrderModel,
    getUserProfile: getUserProfile,
    createOrderFromBasket: createOrderFromBasket,
    createPayment: createPayment,
    buildPaymentData: buildPaymentData,
    flagAsPotentialFraud: flagAsPotentialFraud,
    createOrderFromBasketUUID: createOrderFromBasketUUID,
    setOrderMerchantReference: setOrderMerchantReference,
    capturePayment: capturePayment,
    isAvailableForManualCapture: isAvailableForManualCapture,
    cancelAlmaPayment: cancelAlmaPayment,
    CAPTURE: CAPTURE,
    isPaymentExpired: isPaymentExpired,
    isPaymentAuthorizationExpired: isPaymentAuthorizationExpired
};
