var Mac = require('dw/crypto/Mac');
var Encoding = require('dw/crypto/Encoding');

/**
* Check is the IPN signature is valid
* @param {string|null} almaSignature signature to check
* @param {string} paymentId Paymewnt id
* @param {string} key key to check the signature
* @throws Error
*/
function checkIpnSignature(almaSignature, paymentId, key) {
    if (!almaSignature) {
        throw new Error('There is no signature in header');
    }

    var mac = new Mac(Mac.HMAC_SHA_256);
    var hmac = mac.digest(paymentId, key);
    var hmacHex = Encoding.toHex(hmac);

    if (hmacHex !== almaSignature) {
        throw new Error('Signature is not valid');
    }
}

module.exports = {
    checkIpnSignature: checkIpnSignature
};
