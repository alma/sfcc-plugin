var server = require('server');

server.extend(module.superModule);

server.append('Show', function (req, res, next) {
    var almaWidgetHelper = require('*/cartridge/scripts/helpers/almaWidgetHelper');
    var viewData = almaWidgetHelper.getViewData(
        res,
        'cart',
        'Cart-BasketWidgetData'
    );
    res.setViewData(viewData);

    next();
});

server.get('BasketWidgetData', server.middleware.https, function (req, res, next) {
    var BasketMgr = require('dw/order/BasketMgr');
    var almaPlanHelper = require('*/cartridge/scripts/helpers/almaPlanHelper');
    var almaHelpers = require('*/cartridge/scripts/helpers/almaHelpers');
    var almaWidgetHelper = require('*/cartridge/scripts/helpers/almaWidgetHelper');

    var currentBasket = BasketMgr.getCurrentBasket();
    var amount = Math.round(currentBasket.totalGrossPrice.multiply(100).value);

    var productIds = [];
    currentBasket.getAllProductLineItems().toArray().forEach(function (productLineItem) {
        productIds.push(productLineItem.getProductID());
    });
    var isWidgetEnabled = almaWidgetHelper.isWidgetEnabled('product') && !almaHelpers.haveExcludedCategory(productIds);

    res.json({
        isWidgetEnabled: isWidgetEnabled,
        paymentTypes: almaPlanHelper.getPlansForWidget(),
        amount: amount
    });

    return next();
});

module.exports = server.exports();
