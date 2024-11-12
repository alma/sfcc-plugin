/* eslint-disable no-console */
import gulp from 'gulp';
import zip from 'gulp-zip';
import {deleteSync} from 'del';
import path from 'path';
import { config } from 'dotenv';
import { createDir } from './fs.js';

config({
  path: path.resolve(new URL('.', import.meta.url).pathname, '../.env')
});

/**
 * Create payment processor and payment methods files
 */
async function createPaymentRefFiles() {
  const siteDir = `./metadata/site_template/sites/${process.env.SFCC_SITE_NAME}/`;
  await createDir(siteDir);

  console.log('Copying ref. files');
  const paymentRefFiles = './site_preference_builder/ref/payment/*.xml';
  gulp.src(paymentRefFiles).pipe(gulp.dest(siteDir));
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
function createZipFile() {
  console.log('Creating archive');
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
  console.log(`Your SFCC site name: ${process.env.SFCC_SITE_NAME}`);

  await createPaymentRefFiles();
  await copyServiceFile();
  await createZipFile();

  console.log('Done');
  return 0;
}

main().catch(error => {
  console.error('An error occurred:', error);
  process.exit(1);
});
