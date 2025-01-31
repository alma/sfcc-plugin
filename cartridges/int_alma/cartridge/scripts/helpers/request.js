var URLUtils = require('dw/web/URLUtils');
var pkg = require('../../../package.json');

/**
 * Creates json objects for request
 * @param {dw.order.LineItemCtnr} lineItemCtnr - basket or order
 * @returns {Object} request
 */
function createPaymentRequest(lineItemCtnr) {
    var shipment = lineItemCtnr.defaultShipment;
    var shippingAddress = shipment.shippingAddress;
    var almaHelper = require('*/cartridge/scripts/helpers/almaHelpers');

    return {
        payment: {
            installment_counts: 3, // ou 1 pour le payement en 1+15jours
            deferred_days: 0, // for 3 times payement or 15 if not,
            deferred_months: 0, // for 3 times payement or 15 if not,
            purchase_amount: Math.round(lineItemCtnr.totalGrossPrice.multiply(100).value),
            return_url: URLUtils.http('Alma-PaymentSuccess').toString(),
            ipn_callback_url: URLUtils.http('Alma-IPN').toString(),
            customer_cancel_url: URLUtils.https('Alma-CustomerCancel').toString(),
            shipping_address: {
                first_name: shippingAddress.firstName,
                last_name: shippingAddress.lastName,
                line1: shippingAddress.address1,
                postal_code: shippingAddress.postalCode,
                city: shippingAddress.city
            },
            locale: shippingAddress.countryCode.value,
            custom_data: {
                cms_name: 'SFCC',
                cms_version: almaHelper.getSfccVersion(),
                alma_plugin_version: pkg.version
            }
        },
        customer: {
            first_name: shippingAddress.firstName,
            last_name: shippingAddress.lastName,
            email: lineItemCtnr.customerEmail,
            phone: shippingAddress.phone
        },
        order: {
            merchant_reference: lineItemCtnr.orderNo
        }
    };
}

exports.createPaymentRequest = createPaymentRequest;
