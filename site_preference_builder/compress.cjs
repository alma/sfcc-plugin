const gulp = require('gulp');
const path = require('path');
require('dotenv').config({
    path: path.resolve(__dirname, '../.env')
});

const { createDir } = require('./fs');

let deleteSync;
let zip;

/**
 * Charge dynamiquement les modules ESM nécessaires
 */
async function loadDependencies() {
    if (!deleteSync || !zip) {
        const del = await import('del');
        deleteSync = del.deleteSync;
        zip = (await import('gulp-zip')).default;
    }
}

/**
 * Create payment processor and payment methods files
 */
async function createPaymentRefFiles() {
    const siteDir = `./metadata/site_template/sites/${process.env.SFCC_SITE_NAME}/`;
    createDir(siteDir);

    console.log('Copying ref. files');
    const paymentRefFiles = './site_preference_builder/ref/payment/*.xml';
    gulp.src(paymentRefFiles)
        .pipe(gulp.dest(siteDir));
}

/**
 * Create services file
 */
async function copyServiceFile() {
    console.log('Copying service file');
    gulp.src('./site_preference_builder/ref/services.xml')
        .pipe(gulp.dest('./metadata/site_template/'));
}

/**
 * Create Archive
 */
async function createZipFile() {
    console.log('Creating archive');
    await loadDependencies(); // Charger les modules ESM nécessaires
    deleteSync(['./site_template.zip']);
    gulp.src('./metadata/**')
        .pipe(zip('site_template.zip'))
        .pipe(gulp.dest('./'));
}

/**
 * entry point
 * @returns {number} 0|1 0 is success, 1 is an error
 */
async function main() {
    if (!process.env.SFCC_SITE_NAME) {
        console.error('Undefined env variable SFCC_SITE_NAME. Please go to your .env file to configure it');
        return 1;
    }
    console.log(`Your SFCC site name : ${process.env.SFCC_SITE_NAME}`);

    await createPaymentRefFiles();
    await copyServiceFile();
    await createZipFile();

    console.log('Done');

    return 0;
}

main();
