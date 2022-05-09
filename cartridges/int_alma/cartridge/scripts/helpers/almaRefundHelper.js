'use strict';

/**
 * @param {dw.order.Order} order order to refund
 * @param {int|null} amount amount for refund
 * @returns {{method: string, merchant_reference: *, pid: (string|*)}} return params
 */
function refundPaymentParams(order, amount) {
    if (amount <= 0) {
        throw Error('Amount can\'t be negative.');
    }

    if (order.getTotalGrossPrice() < amount) {
        throw Error('Amount can\'t be upper than order total gross price.');
    }

    if (amount) {
        return {
            method: 'POST',
            pid: order.custom.almaPaymentId,
            merchant_reference: order.orderNo,
            amount: Math.round(amount * 100)
        };
    }
    return {
        method: 'POST', pid: order.custom.almaPaymentId, merchant_reference: order.orderNo
    };
}

/**
 * @param {dw.order.Order} order order to refund
 * @param {int|null} amount amount for refund
 */
exports.refundPaymentForOrder = function (order, amount) {
    var Transaction = require('dw/system/Transaction');
    var refundService = require('*/cartridge/scripts/services/alma').refundPayment;

    if (!order) {
        throw Error('Order not found');
    }

    var httpResult = refundService()
        .call(refundPaymentParams(order, amount));


    if (httpResult.msg !== 'OK') {
        throw Error('Could not create refund on Alma side.');
    }

    Transaction.wrap(function () {
        order.custom.ALMA_Refunded = true; // eslint-disable-line no-param-reassign
    });
};

