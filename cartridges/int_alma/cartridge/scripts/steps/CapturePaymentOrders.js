var Order = require('dw/order/Order');
var Status = require('dw/system/Status');

/**
 * Try to make a capture while we have an order
 * @param {Object} orders orders
 * @param {Object} CAPTURE string constante for capture
 */
function makeCaptureWhileHaveAnOrder(orders, CAPTURE) {
    var Logger = require('dw/system/Logger');
    var almaOrderHelper = require('*/cartridge/scripts/helpers/almaOrderHelper');
    var almaPaymentHelper = require('*/cartridge/scripts/helpers/almaPaymentHelper');

    while (orders.hasNext()) {
        var order = orders.next();
        var params = { external_id: order.custom.almaPaymentId };
        var amount = order.getTotalGrossPrice().value;
        var captureType = CAPTURE.total;
        var partialCaptureAmount = almaOrderHelper.getPartialCaptureAmount(order);
        try {
            if (partialCaptureAmount) {
                captureType = CAPTURE.partial;
                amount = partialCaptureAmount;
            }
            params.amount = amount * 100;
            var capture = almaPaymentHelper.capturePayment(params);
            almaOrderHelper.setAlmaDeferredCaptureFields(order, captureType.code, amount);
            Logger.info(captureType.description + ' payment: order id: {0} - payment id: {1} - capture id : {2}', [order.orderNo, order.custom.almaPaymentId, capture.id]);
        } catch (e) {
            almaOrderHelper.setAlmaDeferredCaptureFields(order, CAPTURE.failed.code);
            Logger.warn(CAPTURE.failed.description + ' payment: order id: {0}, payment id: {1}. Error message: {2}', [order.orderNo, order.custom.almaPaymentId, e.toString()]);
        }
    }
}

exports.execute = function () {
    var OrderMgr = require('dw/order/OrderMgr');
    var almaPaymentHelper = require('*/cartridge/scripts/helpers/almaPaymentHelper');

    var CAPTURE = almaPaymentHelper.CAPTURE;
    var orders = OrderMgr.searchOrders(
        'custom.ALMA_Deferred_Capture_Status={0} and status != {1} and status != {2}',
        null,
        CAPTURE.toCapture.code,
        Order.ORDER_STATUS_FAILED,
        Order.ORDER_STATUS_CANCELLED
    );

    if (orders.count > 0) {
        makeCaptureWhileHaveAnOrder(orders, CAPTURE);
    }

    return new Status(Status.OK);
};
