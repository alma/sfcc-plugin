var server = require('server');

/**
 * Fetch merchant related infos
 * @returns {Object} merchant data
 */
function getAlmaInfo() {
    var almaHelpers = require('*/cartridge/scripts/helpers/almaHelpers');

    return {
        merchantId: almaHelpers.getMerchantId(),
        mode: almaHelpers.getMode(),
        isAlmaEnable: almaHelpers.isAlmaEnable(),
        isEnableOnShipment: almaHelpers.isAlmaOnShipment()
    };
}

/**
 * Fetch all the Alma URL needed by frontend
 * @returns {Object} string urls
 */
function getAlmaUrls() {
    var URLUtils = require('dw/web/URLUtils');

    return {
        return_url: URLUtils.http('Alma-PaymentSuccess').toString(),
        ipn_callback_url: URLUtils.http('Alma-IPN').toString(),
        customer_cancel_url: URLUtils.https('Alma-CustomerCancel').toString(),
        data_url: URLUtils.http('Alma-BasketData').toString(),
        create_payment_url: URLUtils.https('Alma-CreatePaymentUrl').toString(),
        order_amount_url: URLUtils.http('Alma-OrderAmount').toString(),
        inpage_checkout_url: URLUtils.http('Alma-InpageCheckout').toString(),
        plans_url: URLUtils.http('Alma-Plans').toString()
    };
}

server.extend(module.superModule);

server.append('Begin', function (req, res, next) {
    var Resource = require('dw/web/Resource');
    var getLocale = require('*/cartridge/scripts/helpers/almaHelpers').getLocale;
    var almaPlanHelper = require('*/cartridge/scripts/helpers/almaPlanHelper');
    var almaHelpers = require('*/cartridge/scripts/helpers/almaHelpers');
    var almaConfigInfo = getAlmaInfo();
    var almaConfigHelper = require('*/cartridge/scripts/helpers/almaConfigHelper');

    var BasketMgr = require('dw/order/BasketMgr');
    var currentBasket = BasketMgr.getCurrentBasket();

    var productIds = [];
    currentBasket.getAllProductLineItems().toArray().forEach(function (productLineItem) {
        productIds.push(productLineItem.getProductID());
    });

    // if alma isn't activated don't even bother to call any API or if we have a category excluded
    if (!almaConfigInfo.isAlmaEnable || almaHelpers.haveExcludedCategory(productIds)) {
        next();
        return;
    }

    var isDeferredCaptureEnabled = almaConfigHelper.isDeferredCaptureEnable();

    var viewData = Object.assign(
        res.getViewData(),
        almaConfigInfo,
        getAlmaUrls(),
        {
            currencyCode: currentBasket.currencyCode,
            purchase_amount: Math.round(currentBasket.totalGrossPrice.multiply(100).value),
            plans: almaPlanHelper.getPlansForCheckout(getLocale(req), currentBasket, isDeferredCaptureEnabled),
            inpage_on_close_message: Resource.msg('alma.inpage_on_close_message', 'alma', null),
            inpage_on_failure_message: Resource.msg('alma.inpage_on_failure_message', 'alma', null),
            locale: getLocale(req)
        }
    );

    res.setViewData(viewData);
    next();
});

module.exports = server.exports();
