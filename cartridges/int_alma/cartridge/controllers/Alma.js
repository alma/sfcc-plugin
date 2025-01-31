var server = require('server');
var logger = require('dw/system/Logger').getLogger('alma');

/**
 * Helper that build the view params for Alma controller
 * @param {Object} paymentObj the payment to describe
 * @param {dw/order/Order} order the current order
 * @param {string} localeId the local
 * @param {Customer|null} reqProfile profile given in the request
 * @returns {Object} the data to be given to the view
 */
function buildViewParams(paymentObj, order, localeId, reqProfile) {
    var reportingUrlsHelper = require('*/cartridge/scripts/reportingUrls');
    var almaPaymentHelper = require('*/cartridge/scripts/helpers/almaPaymentHelper');

    var orderModel = almaPaymentHelper.getOrderModel(order, localeId);

    var reportingURLs = reportingUrlsHelper.getOrderReportingURLs(order);

    var profile = almaPaymentHelper.getUserProfile(orderModel.orderEmail);

    var isReturningCustomer = reqProfile || profile;

    var viewParams = {
        order: orderModel,
        returningCustomer: true,
        reportingURLs: reportingURLs,
        paymentObj: paymentObj
    };

    if (!isReturningCustomer) {
        var passwordForm = server.forms.getForm('newPasswords');
        passwordForm.clear();
        viewParams.passwordForm = passwordForm;
    }
    return viewParams;
}

/**
 * Ensure that Alma received the right amount and that SFCC order is synced
 * @param {Object} paymentObj the payment to describe
 * @param {dw/order/Order} order the current order
 */
function affectOrder(paymentObj, order) {
    var Transaction = require('dw/system/Transaction');
    var OrderMgr = require('dw/order/OrderMgr');
    var Order = require('dw/order/Order');
    var almaPaymentHelper = require('*/cartridge/scripts/helpers/almaPaymentHelper');
    var acceptOrder = require('*/cartridge/scripts/helpers/almaPaymentHelper').acceptOrder;

    var orderTotal = Math.round(order.totalGrossPrice.multiply(100).value);

    if (paymentObj.purchase_amount !== orderTotal || !(paymentObj.state === 'in_progress' || paymentObj.state === 'paid')) {
        Transaction.wrap(function () {
            order.trackOrderChange('Total or status is wrong');
            OrderMgr.failOrder(order, true);
        });

        var reason = paymentObj.purchase_amount !== orderTotal ? 'amount_mismatch' : 'state_error';
        almaPaymentHelper.flagAsPotentialFraud(paymentObj.id, reason);

        var potentialFraudErrorContext = {
            Payment_ID: paymentObj.id,
            Reason: reason,
            Order_ID: order.getOrderNo()
        };
        logger.warn('Flag potential fraud | {0}', [potentialFraudErrorContext]);
        throw new Error(reason);
    }

    if (almaPaymentHelper.isPaymentExpired(paymentObj)) {
        Transaction.wrap(function () {
            order.trackOrderChange('Payment is expired');
            OrderMgr.failOrder(order, true);
        });

        logger.warn('Payment: {0} is expired', [paymentObj.id]);
        throw new Error('payment_expired');
    }

    if (almaPaymentHelper.isPaymentAuthorizationExpired(paymentObj)) {
        Transaction.wrap(function () {
            order.trackOrderChange('Payment’s authorization is expired');
            OrderMgr.cancelOrder(order);
        });

        logger.warn('Authorization for the payment: {0} is expired', [paymentObj.id]);
        throw new Error('authorization_expired');
    }

    var isOnShipmentPaymentEnabled = require('*/cartridge/scripts/helpers/almaOnShipmentHelper').isOnShipmentPaymentEnabled;
    var paymentStatus = isOnShipmentPaymentEnabled(paymentObj.installments_count) ? Order.PAYMENT_STATUS_NOTPAID : Order.PAYMENT_STATUS_PAID;
    acceptOrder(order, paymentStatus);
}

/**
 * Request order from OrderMgr by Alma payment ID
 * @param {string} pid payment id
 * @returns {Object} order
 */
function getOrderByAlmaPaymentId(pid) {
    var OrderMgr = require('dw/order/OrderMgr');
    return OrderMgr.queryOrder(
        'custom.almaPaymentId={0}',
        pid
    );
}

/**
 * Helper for build paymentObj
 * @param {string} pid payment id
 * @returns {Object} an Alma payment object
 */
function buildPaymentObj(pid) {
    var paymentHelper = require('*/cartridge/scripts/helpers/almaPaymentHelper');
    return paymentHelper.getPaymentObj(pid);
}

server.get('PaymentSuccess', function (req, res, next) {
    var paymentHelper = require('*/cartridge/scripts/helpers/almaPaymentHelper');
    var orderHelper = require('*/cartridge/scripts/helpers/almaOrderHelper');
    var configHelper = require('*/cartridge/scripts/helpers/almaConfigHelper');
    var paymentObj;

    try {
        paymentObj = buildPaymentObj(req.querystring.pid);
    } catch (e) {
        res.setStatusCode(500);
        res.render('error', {
            message: 'Can not find any payment for this order. Your order will fail. Error message: ' + e.toString()
        });
        return next();
    }
    var order = getOrderByAlmaPaymentId(req.querystring.pid);

    var isDeferredCapture = paymentHelper.isAvailableForManualCapture(
        configHelper.isDeferredCaptureEnable(),
        paymentObj.installments_count,
        paymentObj.deferred_days
    );

    if (!order) {
        order = paymentHelper.createOrderFromBasket(req.querystring.alma_payment_method);
        orderHelper.addAlmaDataToOrder(req.querystring.pid, order, isDeferredCapture);
        paymentHelper.setOrderMerchantReference(req.querystring.pid, order);
    }

    // we probably should throw an error if we don't have an order
    if (order) {
        paymentHelper.authorizePaymentProcessor(order);
        try {
            affectOrder(paymentObj, order);
        } catch (e) {
            res.setStatusCode(500);
            res.render('error', {
                message: e.toString()
            });
            return next();
        }
    }
    paymentHelper.emptyCurrentBasket();
    orderHelper.addAlmaPaymentDetails(order, paymentHelper.getPaymentDetails(paymentObj));

    res.render(
        'checkout/confirmation/confirmation',
        buildViewParams(paymentObj, order, req.locale.id, req.currentCustomer.profile)
    );

    req.session.raw.custom.orderID = req.querystring.pid;

    return next();
});

server.get(
    'CustomerCancel',
    server.middleware.https,
    function (req, res, next) {
        var OrderMgr = require('dw/order/OrderMgr');
        var Transaction = require('dw/system/Transaction');

        var almaPaymentId = req.querystring.pid;
        var order = OrderMgr.searchOrder('custom.almaPaymentId={0}', almaPaymentId);

        if (!order) {
            res.redirect('Home-Show');
            return next();
        }

        Transaction.wrap(function () {
            OrderMgr.failOrder(order, true);
        });
        res.redirect('Cart-Show');
        return next();
    }
);

server.get('IPN', function (req, res, next) {
    var paymentHelper = require('*/cartridge/scripts/helpers/almaPaymentHelper');
    var orderHelper = require('*/cartridge/scripts/helpers/almaOrderHelper');
    var almaSecurityHelper = require('*/cartridge/scripts/helpers/almaSecurityHelper');
    var almaHelpers = require('*/cartridge/scripts/helpers/almaHelpers');
    var paymentObj;
    var paymentId = req.querystring.pid;
    var signature = req.httpHeaders.get('X-Alma-Signature');

    try {
        almaSecurityHelper.checkIpnSignature(signature, paymentId, almaHelpers.getApiKey());
    } catch (e) {
        res.setStatusCode(500);
        res.render('error', {
            message: e.message
        });
        return next();
    }

    try {
        paymentObj = buildPaymentObj(paymentId);
    } catch (e) {
        res.setStatusCode(500);
        res.render('error', {
            message: 'Can not find any payment for this order. Your order will fail. Error message: ' + e.toString()
        });
        return next();
    }
    var order = getOrderByAlmaPaymentId(paymentId);

    if (!order) {
        var basketUuid = paymentObj.custom_data.basket_id;
        order = paymentHelper.createOrderFromBasketUUID(basketUuid);
        orderHelper.addPidToOrder(order, paymentId);
    }

    if (!order) {
        res.setStatusCode(500);
        res.json({
            error: 'Order is not created'
        });
        return next();
    }

    try {
        affectOrder(paymentObj, order);

        orderHelper.addPidToOrder(order, req.querystring.pid);
        orderHelper.addAlmaPaymentDetails(order, paymentHelper.getPaymentDetails(paymentObj));
    } catch (e) {
        res.setStatusCode(500);
        res.json({
            error: e.toString()
        });
        return next();
    }

    res.setStatusCode(200);
    res.json({
        error: false,
        message: 'Order is placed'
    });
    return next();
});

server.get('BasketData', server.middleware.https, function (req, res, next) {
    var almaHelper = require('*/cartridge/scripts/helpers/almaHelpers');
    var BasketMgr = require('dw/order/BasketMgr');
    var formatAddress = require('*/cartridge/scripts/helpers/almaAddressHelper').formatAddress;
    var isOnShipmentPaymentEnabled = require('*/cartridge/scripts/helpers/almaOnShipmentHelper').isOnShipmentPaymentEnabled;
    var formatCustomerData = require('*/cartridge/scripts/helpers/almaHelpers').formatCustomerData;
    var pkg = require('../../package.json');

    var currentBasket = BasketMgr.getCurrentBasket();
    var profile = currentBasket.getCustomer().profile;

    res.json({
        shipping_address: formatAddress(currentBasket.getDefaultShipment().shippingAddress),
        billing_address: formatAddress(currentBasket.getBillingAddress()),
        customer: formatCustomerData(profile, currentBasket.getCustomerEmail(), formatAddress(currentBasket.getDefaultShipment().shippingAddress)),
        isEnableOnShipment: isOnShipmentPaymentEnabled(req.querystring.installment),
        cms_name: 'SFCC',
        cms_version: almaHelper.getSfccVersion(),
        alma_plugin_version: pkg.version
    });

    return next();
});

server.get('OrderAmount', server.middleware.https, function (req, res, next) {
    var BasketMgr = require('dw/order/BasketMgr');
    var currentBasket = BasketMgr.getCurrentBasket();
    res.json({
        purchase_amount: Math.round(currentBasket.totalGrossPrice.multiply(100).value)
    });

    return next();
});

server.post('CreatePaymentUrl', server.middleware.https, function (req, res, next) {
    var getLocale = require('*/cartridge/scripts/helpers/almaHelpers').getLocale;
    var almaPaymentHelper = require('*/cartridge/scripts/helpers/almaPaymentHelper');
    var almaConfigHelper = require('*/cartridge/scripts/helpers/almaConfigHelper');

    var isDeferredCapture = almaPaymentHelper.isAvailableForManualCapture(
        almaConfigHelper.isDeferredCaptureEnable(),
        req.querystring.installments,
        req.querystring.deferred_days
    );

    var paymentData = almaPaymentHelper.buildPaymentData(
        req.querystring.installments,
        req.querystring.deferred_days,
        getLocale(req),
        isDeferredCapture
    );

    try {
        var result = almaPaymentHelper.createPayment(paymentData);
        res.json(result);
    } catch (e) {
        res.setStatusCode(500);
        res.render('error', {
            message: 'Could not create payment on Alma side. Error message: ' + e.toString()
        });
    }
    return next();
});

server.post(
    'Refund',
    server.middleware.https,
    function (req, res, next) {
        var OrderMgr = require('dw/order/OrderMgr');
        var refundHelper = require('*/cartridge/scripts/helpers/almaRefundHelper');
        var order = OrderMgr.searchOrder('orderNo={0}', req.querystring.id);
        var amount = req.querystring.amount;

        if (!order) {
            res.setStatusCode(404);
            res.json({
                error: 'Order not found'
            });
            return next();
        }

        try {
            res.json(refundHelper.refundPaymentForOrder(order, amount));
        } catch (e) {
            res.setStatusCode(500);
            res.json({
                error: e.message
            });
        }

        return next();
    }
);

server.get(
    'InpageCheckout',
    server.middleware.https,
    function (req, res, next) {
        var almaPaymentHelper = require('*/cartridge/scripts/helpers/almaPaymentHelper');
        var getLocale = require('*/cartridge/scripts/helpers/almaHelpers').getLocale;
        var almaConfigHelper = require('*/cartridge/scripts/helpers/almaConfigHelper');
        var orderHelper = require('*/cartridge/scripts/helpers/almaOrderHelper');

        var isDeferredCapture = almaPaymentHelper.isAvailableForManualCapture(
            almaConfigHelper.isDeferredCaptureEnable(),
            req.querystring.installments,
            req.querystring.deferred_days
        );

        var paymentData = almaPaymentHelper.buildPaymentData(
            req.querystring.installments,
            req.querystring.deferred_days,
            getLocale(req),
            isDeferredCapture
        );

        try {
            var almaPayment = almaPaymentHelper.createPayment(paymentData);
            var order = getOrderByAlmaPaymentId(almaPayment.id);

            if (!order) {
                order = almaPaymentHelper.createOrderFromBasket(req.querystring.alma_payment_method);
                orderHelper.addAlmaDataToOrder(almaPayment.id, order, isDeferredCapture);
                almaPaymentHelper.setOrderMerchantReference(almaPayment.id, order);
            }
            res.setStatusCode(200);
            res.json({
                order: order,
                payment_id: almaPayment.id
            });
        } catch (e) {
            res.setStatusCode(500);

            if (e.name === 'create_payment_error') {
                res.json({
                    error: 'Could not create payment on Alma side'
                });
            } else {
                res.json({
                    error: e.message
                });
            }
        }

        return next();
    }
);

server.get(
    'Plans',
    server.middleware.https,
    function (req, res, next) {
        var getLocale = require('*/cartridge/scripts/helpers/almaHelpers').getLocale;
        var almaPlanHelper = require('*/cartridge/scripts/helpers/almaPlanHelper');

        var BasketMgr = require('dw/order/BasketMgr');
        var almaConfigHelper = require('*/cartridge/scripts/helpers/almaConfigHelper');

        var isDeferredCaptureEnabled = almaConfigHelper.isDeferredCaptureEnable();
        var currentBasket = BasketMgr.getCurrentBasket();

        res.json({
            plans: almaPlanHelper.getPlansForCheckout(getLocale(req), currentBasket, isDeferredCaptureEnabled)
        });
        return next();
    }
);

module.exports = server.exports();
