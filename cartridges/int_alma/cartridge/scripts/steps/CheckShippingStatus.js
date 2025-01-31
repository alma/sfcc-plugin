/**
 * Check if we should trigger the payment for an Order that have been shipped
 * @param {dw.order.Order} order to be paid
 * @returns {boolean} should we trigger this order payment
 */
function isOrderToBePaidOnShipment(order) {
    var Order = require('dw/order/Order');

    return order.custom.almaPaymentId
        && parseInt(order.paymentStatus, 10) === parseInt(Order.PAYMENT_STATUS_NOTPAID, 10);
}

/**
 * return the alma trigger payment service
 * @returns {Object} the service
 */
function getTriggerPaymentService() {
    var triggerPayment = require('../../scripts/services/alma').triggerPayment;
    return triggerPayment();
}

/**
 * Call the alma trigger payment API
 * @param {Object} triggerService service to call
 * @param {dw.order.Order} order to be triggered
 */
function triggerPaymentForOrder(triggerService, order) {
    var Order = require('dw/order/Order');
    var Transaction = require('dw/system/Transaction');

    var httpResult = triggerService.call({
        method: 'POST',
        pid: order.custom.almaPaymentId
    });

    if (httpResult.msg !== 'OK') {
        throw Error(httpResult.msg);
    }

    Transaction.wrap(function () {
        order.custom.ALMA_ResponseDetails = 'Shipping';
        order.setPaymentStatus(Order.PAYMENT_STATUS_PAID);
    });
}

/**
 * Query SFCC orders to fetch the Order that have been shipped and have the onShipment flag
 * @returns {dw.util.SeekableIterator} a collection of Order
 */
function getOrderShipped() {
    var OrderMgr = require('dw/order/OrderMgr');

    return OrderMgr.searchOrders("shippingStatus={0} and custom.ALMA_ResponseDetails='onShipment'", null, 2);
}

exports.execute = function () {
    var Logger = require('dw/system/Logger');
    var Status = require('dw/system/Status');

    var orders = getOrderShipped();
    var triggerService = getTriggerPaymentService();
    var errors = [];

    Logger.info('[INFO][ALMA pay on shipment] job launched for: ' + orders.count + ' orders.');
    if (orders.count > 0) {
        while (orders.hasNext()) {
            var orderItem = orders.next();
            if (isOrderToBePaidOnShipment(orderItem)) {
                try {
                    triggerPaymentForOrder(triggerService, orderItem);
                } catch (e) {
                    Logger.error('[ERROR][ALMA pay on shipment] : ' + e);
                    errors.push(e);
                }
            }
        }
    }

    if (errors.length > 0) {
        return new Status(Status.ERROR);
    }

    return new Status(Status.OK);
};
