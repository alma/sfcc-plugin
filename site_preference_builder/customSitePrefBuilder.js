const fs = require('fs');

const xml2js = require('xml2js');
const {
    ConfigException
} = require('./error');

const path = require('path');
require('dotenv').config({
    path: path.resolve(__dirname, '../.env')
});

let localisationFile = './messages.json';

const locale = process.env.LOCALE;
if (locale !== 'en_GB' && fs.existsSync(path.join(__dirname, `messages-${locale}.json`))) {
    localisationFile = `./messages-${locale}.json`;
}

const messages = require(localisationFile);

// we also remove 1x that isn't deferred, as the api will provide it,
// but we don't want to display it
const filterAllowedPlan = (plan) => {
    return plan.allowed;
};

const getMessageKey = (installments, deferredDays) => {
    if (installments > 1 && deferredDays > 0) {
        return 'x_times_deferred_payment';
    }
    if (deferredDays > 0) {
        return 'deferred_payment';
    }
    if (installments >= 1) {
        return 'x_times_payment';
    }
    throw new ConfigException('could not find this type of payment');
};

const getSitePrefDisplayInfos = (plan) => {
    const installments = plan.installments_count;
    const deferredDays = plan.deferred_days;
    const minAmount = plan.min_purchase_amount / 100;
    const maxAmount = plan.max_purchase_amount / 100;

    const message = messages[getMessageKey(installments, deferredDays)];
    // use of another variable to avoid side effects
    const currentMessage = {};
    // TODO: use Object.entries when we refactor code to match Node >=22
    // eslint-disable-next-line no-restricted-syntax
    for (let messageKey of Object.keys(message)) {
        currentMessage[messageKey] = message[messageKey]
            .replace('[[installments]]', installments)
            .replace('[[deferredDays]]', deferredDays);
    }

    return {
        id: `ALMA_general_${installments}_${deferredDays}`,
        lang: 'x-default',
        text: currentMessage.title,
        min: currentMessage.min,
        min_disclaimer: currentMessage.min_disclaimer.replace('[[amount]]', minAmount),
        max: currentMessage.max,
        max_disclaimer: currentMessage.max_disclaimer.replace('[[amount]]', maxAmount),
        group: currentMessage.group,
        group_id: `ALMA_${installments}_${deferredDays}`
    };
};

/**
 *
 * @param {Object} sitePref should have the following attributes: id, name, type.
 * mandatory, externallyManaged, description and defaultValue are optionals
 * @returns {Object} the created custom site preference
 */
const buildCustomSitePrefObject = (sitePref) => {
    /**
   * Site pref attributes need to be inputted in a specific order
   * and js is not very good with that
   */
    const customSitePref = {
        $: {
            'attribute-id': sitePref.id
        },
        'display-name': [{
            _: sitePref.name,
            $: {
                'xml:lang': 'x-default'
            }
        }]
    };

    if (sitePref.description) {
        customSitePref.description = [{
            _: sitePref.description,
            $: {
                'xml:lang': 'x-default'
            }
        }];
    }
    customSitePref.type = [sitePref.type];
    customSitePref['mandatory-flag'] = ['false'];
    if (sitePref.mandatory) {
        customSitePref['mandatory-flag'] = [String(sitePref.mandatory)];
    }
    customSitePref['externally-managed-flag'] = ['false'];
    if (sitePref.externallyManaged) {
        customSitePref['externally-managed-flag'] = [String(sitePref.externallyManaged)];
    }
    if (sitePref.defaultValue) {
        customSitePref['default-value'] = [sitePref.defaultValue];
    }
    if (sitePref.valueDefinitions) {
        customSitePref['value-definitions'] = {
            'value-definition': []
        };
        sitePref.valueDefinitions.forEach((value) => {
            customSitePref['value-definitions']['value-definition'].push({
                value: value
            });
        });
    }
    return customSitePref;
};

/**
 *
 * @param {string} id group id
 * @param {string} name group name
 * @param {string[]} attributes to attach to the group
 * @returns {Object} created group
 */
const buildCustomGroupObject = (id, name, attributes) => {
    const group = {
        $: {
            'group-id': id
        },
        'display-name': [{
            _: name,
            $: {
                'xml:lang': 'x-default'
            }
        }],
        attribute: []
    };

    attributes.forEach((attr) => {
        group.attribute.push({
            $: {
                'attribute-id': attr
            }
        });
    });
    return group;
};
exports.xmlToJson = async (fileContent) => xml2js.parseStringPromise(fileContent);

exports.jsonToXML = (jsonSitePref) => {
    const builder = new xml2js.Builder();
    return builder.buildObject(jsonSitePref);
};

exports.addFeePlans = (file, plans) => {
    // only keep needed fields
    const plansToSerialize = plans.map((plan) => {
        return {
            allowed: plan.allowed,
            deferred_days: plan.deferred_days,
            deferred_trigger_limit_days: plan.deferred_trigger_limit_days,
            installments_count: plan.installments_count,
            max_purchase_amount: plan.max_purchase_amount,
            min_purchase_amount: plan.min_purchase_amount
        };
    });

    file.metadata['type-extension'][2]['custom-attribute-definitions'][0]['attribute-definition'].push(
        buildCustomSitePrefObject({
            id: 'ALMA_FEE_PLANS',
            name: 'Advanced Alma plan management',
            type: 'string',
            description: 'Can be used to update your alma plans',
            mandatory: false,
            externallyManaged: false,
            defaultValue: JSON.stringify(plansToSerialize)
        })
    );

    return file;
};

exports.addAPIInfo = (file, url, merchantId) => {
    // add ALMA_APIKey as a custom site pref
    file.metadata['type-extension'][2]['custom-attribute-definitions'][0]['attribute-definition'].push(
        buildCustomSitePrefObject({
            id: 'ALMA_APIKey',
            name: 'Your Alma API key',
            type: 'password',
            mandatory: false,
            externallyManaged: false
        })
    );

    // add ALMA_Merchant_Id as a custom site pref
    file.metadata['type-extension'][2]['custom-attribute-definitions'][0]['attribute-definition'].push(
        buildCustomSitePrefObject({
            id: 'ALMA_Merchant_Id',
            name: 'Your Alma Merchant Id',
            type: 'string',
            mandatory: false,
            externallyManaged: false,
            defaultValue: merchantId
        })
    );

    // add ALMA_APIUrl as a custom site pref
    file.metadata['type-extension'][2]['custom-attribute-definitions'][0]['attribute-definition'].push(
        buildCustomSitePrefObject({
            id: 'ALMA_APIUrl',
            name: 'Alma API Url',
            type: 'string',
            mandatory: false,
            externallyManaged: false,
            defaultValue: url
        })
    );

    return file;
};

exports.addCustomAttrFromPlan = (file, plans) => {
    plans
        .filter(filterAllowedPlan)
        .forEach((plan) => {
            const {
                id,
                text,
                min,
                max,
                min_disclaimer: minDisclaimer,
                max_disclaimer: maxDisclaimer
            } = getSitePrefDisplayInfos(plan);

            file.metadata['type-extension'][2]['custom-attribute-definitions'][0]['attribute-definition'].push(
                buildCustomSitePrefObject({
                    id: id,
                    name: text,
                    type: 'boolean'
                })
            );
            file.metadata['type-extension'][2]['custom-attribute-definitions'][0]['attribute-definition'].push(
                buildCustomSitePrefObject({
                    id: `${id}_min`,
                    name: min,
                    type: 'double',
                    description: minDisclaimer
                })
            );
            file.metadata['type-extension'][2]['custom-attribute-definitions'][0]['attribute-definition'].push(
                buildCustomSitePrefObject({
                    id: `${id}_max`,
                    name: max,
                    type: 'double',
                    description: maxDisclaimer
                })
            );
        });

    return file;
};

exports.addCustomGroupFromPlan = (file, plans) => {
    plans
        .filter(filterAllowedPlan)
        .forEach((plan) => {
            const {
                id,
                group,
                group_id: groupId
            } = getSitePrefDisplayInfos(plan);

            file.metadata['type-extension'][2]['group-definitions'][0]['attribute-group'].push(
                buildCustomGroupObject(groupId, group, [`${id}`, `${id}_min`, `${id}_max`])
            );
        });

    return file;
};

exports.addRefundCustomAttributes = (file) => {
    file.metadata['type-extension'][0]['custom-attribute-definitions'][0]['attribute-definition'].push(
        buildCustomSitePrefObject({
            id: 'almaRefundedAmount',
            name: messages.almaRefundedAmount.name,
            type: 'double',
            mandatory: false,
            externallyManaged: true
        })
    );
    file.metadata['type-extension'][0]['custom-attribute-definitions'][0]['attribute-definition'].push(
        buildCustomSitePrefObject({
            id: 'almaWantedRefundAmount',
            name: messages.almaWantedRefundAmount.name,
            type: 'double',
            mandatory: false,
            externallyManaged: false
        })
    );
    file.metadata['type-extension'][0]['custom-attribute-definitions'][0]['attribute-definition'].push(
        buildCustomSitePrefObject({
            id: 'almaRefundType',
            name: messages.almaRefundType.name,
            description: messages.almaRefundType.description,
            type: 'enum-of-string',
            mandatory: false,
            externallyManaged: false,
            valueDefinitions: [
                messages.almaRefundType.valueDefinitions.total,
                messages.almaRefundType.valueDefinitions.partial
            ]
        })
    );

    return file;
};

exports.addRefundCustomAttributesGroup = (file) => {
    file.metadata['type-extension'][0]['group-definitions'][0]['attribute-group'].push(
        buildCustomGroupObject(
            'AlmaRefund',
            messages.AlmaRefund.name,
            [
                'almaRefundedAmount',
                'almaRefundType',
                'almaWantedRefundAmount'
            ]
        )
    );

    return file;
};
