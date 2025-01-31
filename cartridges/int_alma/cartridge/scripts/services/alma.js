var LocalServiceRegistry = require('dw/svc/LocalServiceRegistry');
var almaHelpers = require('*/cartridge/scripts/helpers/almaHelpers');

/**
 * Builds service for payment creating
 * @returns {dw.svc.Service} service instances
 */
function createPayment() {
    return LocalServiceRegistry.createService('alma', {
        /**
         * @param {dw.svc.HTTPService} service service
         * @param {array} params parameters
         * @returns {string} json parameters as string
         */
        createRequest: function (service, params) {
            service.setRequestMethod('POST');
            service.URL = almaHelpers.getUrl('/v1/payments');
            almaHelpers.addHeaders(service);

            return JSON.stringify(params);
        },
        parseResponse: function (svc, client) {
            return client;
        }
    });
}

/**
 * Builds service for payment trigger
 * @returns {dw.svc.Service} service instances
 */
function triggerPayment() {
    return LocalServiceRegistry.createService('alma', {
        /**
         * @param {dw.svc.HTTPService} service service
         * @param {array} params parameters
         */
        createRequest: function (service, params) {
            service.setRequestMethod('POST');
            service.URL = almaHelpers.getUrl('/v1/payments/' + params.pid + '/trigger');
            almaHelpers.addHeaders(service);
        },
        parseResponse: function (svc, client) {
            return client;
        }
    });
}

/**
 * Builds service for getting payment details
 * @returns {dw.svc.Service} service instances
 */
function getPaymentDetails() {
    return LocalServiceRegistry.createService('alma', {
        /**
         * @param {dw.svc.HTTPService} service service
         * @param {array} params parameters
         */
        createRequest: function (service, params) {
            service.setRequestMethod('GET');
            service.URL = almaHelpers.getUrl('/v1/payments/' + params.pid);
            almaHelpers.addHeaders(service);
        },
        parseResponse: function (svc, client) {
            return client;
        }
    });
}

/**
 * Builds service for getting eligibility. Min and Max values
 * @returns {dw.svc.Service} service instances
 */
function checkEligibility() {
    return LocalServiceRegistry.createService('alma', {
        /**
         * @param {dw.svc.HTTPService} service service
         * @param {array} params parameters
         * @returns {string} json parameters as string
         */
        createRequest: function (service, params) {
            service.setRequestMethod('POST');
            service.URL = almaHelpers.getUrl('/v2/payments/eligibility');
            almaHelpers.addHeaders(service);

            return JSON.stringify(params);
        },
        parseResponse: function (svc, client) {
            return client;
        }
    });
}

/**
 * Builds service for payment refund
 * @returns {dw.svc.Service} service instances
 */
function refundPayment() {
    return LocalServiceRegistry.createService('alma', {
        /**
         * @param {dw.svc.HTTPService} service service
         * @param {array} params parameters
         * @returns {string} json parameters as string
         */
        createRequest: function (service, params) {
            service.setRequestMethod('POST');
            service.URL = almaHelpers.getUrl('/v1/payments/' + params.pid + '/refunds');
            almaHelpers.addHeaders(service);

            return JSON.stringify(params);
        },
        parseResponse: function (svc, client) {
            return client;
        }
    });
}

/**
 * Build service for potential fraud
 * @returns {dw.svc.Service} service instances
 */
function flagAsPotentialFraud() {
    return LocalServiceRegistry.createService('alma', {
        /**
         * @param {dw.svc.HTTPService} service service
         * @param {array} params parameters
         * @returns {string} json parameters as string
         */
        createRequest: function (service, params) {
            service.setRequestMethod('POST');
            service.URL = almaHelpers.getUrl('/v1/payments/' + params.pid + '/potential-fraud');
            almaHelpers.addHeaders(service);

            return JSON.stringify(params);
        },
        parseResponse: function (svc, client) {
            return client;
        }
    });
}

/**
 * Add order_id in merchant_reference
 * @returns {dw.svc.Service} service instances
 */
function setOrderMerchantReferenceAPI() {
    return LocalServiceRegistry.createService('alma', {
        /**
         * @param {dw.svc.HTTPService} service service
         * @param {array} params parameters
         * @returns {string} json parameters as string
         */
        createRequest: function (service, params) {
            service.setRequestMethod('POST');
            service.URL = almaHelpers.getUrl('/v1/payments/' + params.pid + '/orders');
            almaHelpers.addHeaders(service);

            return JSON.stringify(params);
        },
        parseResponse: function (svc, client) {
            return client;
        }
    });
}

/**
 * Create a capture payment
 * @return {dw.svc.Service} service instances
 */
function captures() {
    return LocalServiceRegistry.createService('alma', {
        /**
         * @param {dw.svc.HTTPService} service service
         * @param {array} params parameters
         * @returns {string} json parameters as string
         */
        createRequest: function (service, params) {
            service.setRequestMethod('POST');
            service.URL = almaHelpers.getUrl('/v1/payments/' + params.external_id + '/captures');
            almaHelpers.addHeaders(service);

            return JSON.stringify(params);
        },
        parseResponse: function (svc, client) {
            return client;
        }
    });
}

/**
 * Cancel an alma payment
 * @return {dw.svc.Service} service instances
 */
function cancelAlmaPayment() {
    return LocalServiceRegistry.createService('alma', {
        /**
         * @param {dw.svc.HTTPService} service service
         * @param {array} params parameters
         * @returns {string} json parameters as string
         */
        createRequest: function (service, params) {
            service.setRequestMethod('PUT');
            service.URL = almaHelpers.getUrl('/v1/payments/' + params.external_id + '/cancel');
            almaHelpers.addHeaders(service);

            return JSON.stringify(params);
        },
        parseResponse: function (svc, client) {
            return client;
        }
    });
}

module.exports = {
    getPaymentDetails: getPaymentDetails,
    checkEligibility: checkEligibility,
    triggerPayment: triggerPayment,
    refundPayment: refundPayment,
    createPayment: createPayment,
    potentialFraud: flagAsPotentialFraud,
    setOrderMerchantReferenceAPI: setOrderMerchantReferenceAPI,
    captures: captures,
    cancelAlmaPayment: cancelAlmaPayment
};
