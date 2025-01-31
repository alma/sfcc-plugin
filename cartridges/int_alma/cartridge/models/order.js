var base = module.superModule;

/**
 * OrderModel
 * @param {Object} lineItemContainer lineItemContainer
 * @param {Object} options options
 */
function OrderModel(lineItemContainer, options) {
    base.call(this, lineItemContainer, options);

    this.almaInfo = lineItemContainer.custom.ALMA_ResponseDetails;
}

module.exports = OrderModel;
