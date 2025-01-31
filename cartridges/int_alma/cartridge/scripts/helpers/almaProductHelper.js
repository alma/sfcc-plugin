/**
 * Get product id
 * @param {Object} product product
 * @returns {string} id
 */
function getProductId(product) {
    if (product.isMaster()) {
        return product.getID();
    }
    return product.getMasterProduct().getID();
}

/**
 * Get categories for a product
 * @param {Object} product product
 * @returns {array} categories
 */
function getProductCategories(product) {
    if (product.isMaster()) {
        return product.getAllCategories().toArray();
    }
    return product.getMasterProduct().getAllCategories().toArray();
}

module.exports = {
    getProductId: getProductId,
    getProductCategories: getProductCategories
};
