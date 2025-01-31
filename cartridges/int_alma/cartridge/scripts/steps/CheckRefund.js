/**
 * Check if we should refund the payment
 * @param {dw.order.Order} order to be paid
 * @returns {boolean} should we refund this order payment
 */
function isOrderToBeRefund(order) {
    return (
        order.custom.almaRefundType.toString() === 'Total' || (
            order.custom.almaRefundType.toString() === 'Partial' && order.custom.almaWantedRefundAmount > 0 && order.custom.almaWantedRefundAmount < order.totalGrossPrice.value
        )
    );
}

/**
 * Query SFCC orders to fetch the Order that have been shipped and have the onShipment flag
 * @returns {dw.util.SeekableIterator} a collection of Order
 */
function getOrdersRefunded() {
    var OrderMgr = require('dw/order/OrderMgr');

    return OrderMgr.searchOrders('paymentStatus = {0} and (custom.almaRefundType = \'Total\' or (custom.almaRefundType = \'Partial\' and custom.almaWantedRefundAmount > 0)) and custom.almaPaymentId != NULL', null, 2);
}

/**
 * Call the alma refund payment API
 * @param {dw.order.Order} order to be refunded
 */
function refundPaymentForOrder(order) {
    var refundHelper = require('*/cartridge/scripts/helpers/almaRefundHelper');
    if (order.custom.almaRefundType.toString() === 'Partial') {
        refundHelper.refundPaymentForOrder(order, order.custom.almaWantedRefundAmount);
    } else {
        refundHelper.refundPaymentForOrder(order);
    }
}

/**
 * Cancel a payment when a refund is made on an order with the status ToCapture
 * @param {Object} orderItem order
 * @param {Object} Logger logger
 */
function cancelDeferredCapturePaymentForARefund(orderItem, Logger) {
    var Transaction = require('dw/system/Transaction');
    var AlmaPaymentHelper = require('*/cartridge/scripts/helpers/almaPaymentHelper');
    var amount = 0;
    var deferredStatus = 'ToCapture';
    if (orderItem.custom.almaRefundType.toString() === 'Total') {
        var params = { external_id: orderItem.custom.almaPaymentId };
        amount = orderItem.getTotalGrossPrice().value;
        AlmaPaymentHelper.cancelAlmaPayment(params);
        deferredStatus = 'Canceled';
    }

    if (orderItem.custom.almaRefundType.toString() === 'Partial') {
        Logger.info('Partial refund is not yet implemented with deferred payment - order id {0}', [orderItem.orderNo]);
    }

    /* jshint loopfunc: true */

    Transaction.wrap(function () {
        orderItem.custom.ALMA_Deferred_Capture_Status = deferredStatus;

        orderItem.custom.almaRefundedAmount = amount;

        orderItem.custom.almaWantedRefundAmount = 0;

        orderItem.custom.almaRefundType = null;
    });
}

exports.execute = function () {
    var Logger = require('dw/system/Logger');
    var Status = require('dw/system/Status');
    var orders = getOrdersRefunded();

    Logger.info('[INFO][ALMA refund] job launched for: ' + orders.count + ' orders.');
    if (orders.count > 0) {
        while (orders.hasNext()) {
            var orderItem = orders.next();
            if (isOrderToBeRefund(orderItem)) {
                try {
                    if (orderItem.custom.ALMA_Deferred_Capture_Status === 'ToCapture') {
                        cancelDeferredCapturePaymentForARefund(orderItem, Logger);
                    } else {
                        refundPaymentForOrder(orderItem);
                    }
                } catch (e) {
                    Logger.error('[ERROR][ALMA refund] : ' + e);
                }
            }
        }
    }

    return new Status(Status.OK);
};
