var Transaction = require('dw/system/Transaction');

/**
 * Add PID to order
 * @param {Order} order order
 * @param {string} pid pid
 */
function addPidToOrder(order, pid) {
    Transaction.wrap(function () {
        order.custom.almaPaymentId = pid;
    });
}

/**
 * Add alma payment details in order
 * @param {Order} order order
 * @param {string} payDetail payDetail
 */
function addAlmaPaymentDetails(order, payDetail) {
    Transaction.wrap(function () {
        order.custom.ALMA_ResponseDetails = payDetail;
    });
}

/**
 * Set alma deferred capture status in order
 * @param {Object} order order
 * @param {string} deferredCaptureStatus payDetail
 * @param {number} [amount] amount capture
 */
function setAlmaDeferredCaptureFields(order, deferredCaptureStatus, amount) {
    if (amount) {
        Transaction.wrap(function () {
            order.custom.ALMA_Deferred_Capture_Status = deferredCaptureStatus;
            order.custom.ALMA_Deferred_Capture_Partial_Amount_Captured = amount;
            order.custom.ALMA_Deferred_Capture_Partial_Amount = null;
        });
    } else {
        Transaction.wrap(function () {
            order.custom.ALMA_Deferred_Capture_Status = deferredCaptureStatus;
            order.custom.ALMA_Deferred_Capture_Partial_Amount = null;
        });
    }
}

/**
 * Add Alma data to order
 * @param {string} pid payment id
 * @param {Object} order order
 * @param {boolean} isDeferredCapture is deferred capture
 * @throw Error
 */
function addAlmaDataToOrder(pid, order, isDeferredCapture) {
    addPidToOrder(order, pid);
    if (isDeferredCapture) {
        setAlmaDeferredCaptureFields(order, 'ToCapture');
    } else {
        setAlmaDeferredCaptureFields(order, 'Captured');
    }
}

/**
 * Return amount for partial capture
 * @param {Object} order order from get partial capture amount
 * @return {number|null} the amount value
 */
function getPartialCaptureAmount(order) {
    return order.custom.ALMA_Deferred_Capture_Partial_Amount;
}

module.exports = {
    addPidToOrder: addPidToOrder,
    addAlmaPaymentDetails: addAlmaPaymentDetails,
    addAlmaDataToOrder: addAlmaDataToOrder,
    setAlmaDeferredCaptureFields: setAlmaDeferredCaptureFields,
    getPartialCaptureAmount: getPartialCaptureAmount
};
