const {
    getFeePlansFromAPI
} = require('./api.cjs');
const {
    readFile,
    writeFile,
    createDir
} = require('./fs.js');
const {
    xmlToJson,
    jsonToXML,
    addCustomAttrFromPlan,
    addCustomGroupFromPlan,
    addFeePlans,
    addAPIInfo,
    addRefundCustomAttributes,
    addRefundCustomAttributesGroup
} = require('./customSitePrefBuilder.js');

const path = require('path');
const { writeJobsFile } = require('./jobs');

require('dotenv').config({
    path: path.resolve(__dirname, '../.env')
});

const LIVE_MODE = {
    url: 'https://api.getalma.eu/',
    apiKey: process.env.ALMA_LIVE_API_KEY
};
const TEST_MODE = {
    url: 'https://api.sandbox.getalma.eu/',
    apiKey: process.env.ALMA_TEST_API_KEY
};

const METADIR = './metadata/site_template/meta/';
const INPUT_FILE = './site_preference_builder/ref/system-objecttype-extensions.xml';
const OUTPUT_FILE = './metadata/site_template/meta/system-objecttype-extensions.xml';

const REFUND_IS_DISABLED = 'off';

/**
 * return the merchantId from feeplans
 * @param {Object} feePlans returned from Alma API
 * @returns {string} merchantId
 */
function getMerchantIdFromFeePlans(feePlans) {
    if (!feePlans || feePlans.length === 0) {
        throw new Error('Fee plans are undefined or empty');
    }
    return feePlans[0].merchant;
}

/**
 * Script entry point
 */
// eslint-disable-next-line consistent-return
async function main() {
    if (!process.env.SFCC_SITE_NAME) {
        console.error('Undefined env variable SFCC_SITE_NAME. Please go to your .env file to configure it');
        return 1;
    }

    createDir(METADIR);

    const fileContent = readFile(INPUT_FILE);

    const sitePref = await xmlToJson(fileContent);

    const {
        url,
        apiKey
    } = process.env.ALMA_API_MODE === 'live' ? LIVE_MODE : TEST_MODE;
    const plans = await getFeePlansFromAPI(url, apiKey);
    const merchantId = getMerchantIdFromFeePlans(plans);

    let updatedSitePref = addCustomAttrFromPlan(sitePref, plans);
    updatedSitePref = addCustomGroupFromPlan(updatedSitePref, plans);
    updatedSitePref = addFeePlans(updatedSitePref, plans);
    updatedSitePref = addAPIInfo(updatedSitePref, url, merchantId);

    if (process.env.TOGGLE_REFUND !== REFUND_IS_DISABLED) {
        updatedSitePref = addRefundCustomAttributes(updatedSitePref);
        updatedSitePref = addRefundCustomAttributesGroup(updatedSitePref);
    }

    await writeJobsFile(process.env.TOGGLE_REFUND, plans, process.env.SFCC_SITE_NAME);
    writeFile(OUTPUT_FILE, jsonToXML(updatedSitePref));
}

main().then().catch((e) => console.log(e));
