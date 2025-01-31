const { readFileSync, writeFileSync } = require('fs');
const builder = require('./customSitePrefBuilder');

const INPUT_JOB_SHIPMENT_FILE = './site_preference_builder/ref/jobs/jobShipment.xml';
const INPUT_JOB_REFUND_FILE = './site_preference_builder/ref/jobs/jobRefund.xml';
const INPUT_JOB_DEFERRED_CAPTURE_FILE = './site_preference_builder/ref/jobs/jobDeferredCapture.xml';
const INPUT_JOBS_FILE = './site_preference_builder/ref/jobs/jobs.xml';
const OUTPUT_JOB_SHIPMENT_FILE = './metadata/site_template/jobs.xml';

const allJobs = {
    job: []
};

const merchantHasOnShipment = (plans) => {
    return plans.some((plan) => plan.deferred_trigger_limit_days !== null);
};
exports.merchantHasOnShipment = merchantHasOnShipment;

const getJobShipment = async (plans, siteName) => {
    if (merchantHasOnShipment(plans)) {
        const jobShipment = readFileSync(INPUT_JOB_SHIPMENT_FILE)
            .toString();
        const onShipmentJob = await builder.xmlToJson(jobShipment.replace('[[SITENAME]]', siteName));
        allJobs.job.push(onShipmentJob.job);
    }
};

const getJobDeferredCapture = async (siteName) => {
    const jobDeferredCapture = readFileSync(INPUT_JOB_DEFERRED_CAPTURE_FILE)
        .toString();
    const deferredCaptureJob = await builder.xmlToJson(
        jobDeferredCapture.replace('[[SITENAME]]', siteName)
    );
    allJobs.job.push(deferredCaptureJob.job);
};

const getJobRefund = async (toggleRefund, siteName) => {
    if (toggleRefund === 'off') {
        return;
    }
    const jobRefund = readFileSync(INPUT_JOB_REFUND_FILE)
        .toString();
    const onRefundJob = await builder.xmlToJson(jobRefund.replace('[[SITENAME]]', siteName));
    allJobs.job.push(onRefundJob.job);
};

exports.writeJobsFile = async (toggleRefund, plans, siteName) => {
    await getJobShipment(plans, siteName);
    await getJobRefund(toggleRefund, siteName);
    await getJobDeferredCapture(siteName);

    const jobs = readFileSync(INPUT_JOBS_FILE);
    const jobsContent = await builder.xmlToJson(jobs);

    jobsContent.jobs = Object.assign(jobsContent.jobs, allJobs);
    writeFileSync(OUTPUT_JOB_SHIPMENT_FILE, builder.jsonToXML(jobsContent));
};
