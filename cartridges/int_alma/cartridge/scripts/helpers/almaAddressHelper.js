/**
 * format address for eligibility service
 * @param  {dw.order.OrderAddress} address the customer address
 * @param  {string} email the customer email
 * @returns {Object} formatted for eligibility service
 */
function formatAddress(address, email) {
    if (address === null) {
        return null;
    }
    var result = {
        title: address.jobTitle,
        first_name: address.lastName,
        last_name: address.firstName,
        company: address.companyName,
        line1: address.address1,
        line2: address.address2,
        postal_code: address.postalCode,
        city: address.city,
        country: address.countryCode.value,
        state_province: address.stateCode,
        phone: address.phone
    };
    if (email !== null && email !== 'undefined') {
        result.email = email;
    }
    return result;
}

module.exports = {
    formatAddress: formatAddress
};
