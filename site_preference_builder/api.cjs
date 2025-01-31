let fetch;
const API_VERSION = 'v1';

async function loadFetch() {
    if (!fetch) {
        fetch = (await import('node-fetch')).default;
    }
}

exports.getFeePlansFromAPI = async function (baseurl, key) {
    await loadFetch();
    const url = `${baseurl}/${API_VERSION}/me/fee-plans?kind=general&only=all&deferred=true`;
    try {
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Alma-Auth ${key}`
            }
        });
        return response.json();
    } catch (e) {
        console.error(`Could not reach API : "${url}", please check your .env Error message: ${e.toString()}`);
    }
    return {};
};
