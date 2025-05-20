const puppeteer = require('puppeteer');
const fs = require('fs').promises;
const path = require('path');
const readline = require('readline');


// Configuration for Puppeteer automation
// This object contains URLs and CSS selectors for the web automation of the form.
const config = {
    formUrl: 'https://testsite.getjones.com/ExampleForm/',
    selectors: {
        name: '#name',
        email: '#email',
        phone: '#phone',
        company: '#company',
        employees: '#employees',
        submitButton: 'button.primary.button'
    },
    thankYouPage: 'thank-you.html',
    thankYouText: ['Thank you!', "You'll hear from us soon."]
};

/**
 * @param {string} message - The log message.
 */
// Adds timestamps to log messages.
function logWithTimestamp(message) {
    console.log(`[${new Date().toISOString()}] INFO: ${message}`);
}

/**
 * @param {string} dirPath - The path to the directory to check or create.
 * @throws Will throw an error if unable to access or create the directory.

 */
// Ensures that a directory exists at the provided path.If the directory does not exist, it is created.
async function ensureDirectoryExists(dirPath) {
    try {
        await fs.access(dirPath);
        logWithTimestamp(`Directory verified: ${dirPath}`);
    } catch (error) {
        if (error.code === 'ENOENT') {
            await fs.mkdir(dirPath, { recursive: true });
            logWithTimestamp(`Directory created: ${dirPath}`);
        } else {
            logWithTimestamp(`Failed to access directory ${dirPath}: ${error.message}`);
            throw error;
        }
    }
}


/**
 * Validates the form data against specific criteria for each field.
 * @param {Object} formData - An object containing form field values.
 * @returns {Array} - An array of error messages. If empty, all fields are valid.
 */
function validateFormData(formData) {
    const emailRegex = /@/; // Email must contain at least one "@" character
    const nonEmptyRegex = /^(?!\s*$).+/; // Must contain at least one non-whitespace character

    const errors = [];

    if (!nonEmptyRegex.test(formData[config.selectors.name])) {
        errors.push('Name cannot be empty.');
    }

    if (!emailRegex.test(formData[config.selectors.email])) {
        errors.push('Invalid email format. Email must contain "@" character, Please fill out this field.');
    }

    if (!nonEmptyRegex.test(formData[config.selectors.phone])) {
        errors.push('Phone number cannot be empty, Please fill out this field.');
    }

    if (!nonEmptyRegex.test(formData[config.selectors.company])) {
        errors.push('Company name cannot be empty, Please fill out this field.');
    }

    if (errors.length === 0) {
        logWithTimestamp('All fields passed validation successfully ! ');
        logWithTimestamp('-----------------------------------------------------------------------------');
    }

    return errors;
}


/**
 * @param {puppeteer.Page} page - The Puppeteer page object.
 * @param {Object} formData - The form fields and their respective values to fill in.
 * @throws Will throw an error if a field cannot be filled.
 */
// Fills the form fields on the web page with provided values.
async function fillFormFields(page, formData) {
    logWithTimestamp('Filling form fields...');
    for (const [selector, value] of Object.entries(formData)) {
        try {
            await page.waitForSelector(selector, { visible: true, timeout: 20000 });
            await page.type(selector, value, { delay: Math.floor(Math.random() * 100) + 50 });
            logWithTimestamp(`Field "${selector}" filled with value: ${value} (valid).`);
        } catch (error) {
            logWithTimestamp(`Error filling field ${selector}: ${error.message}`);
            throw error;
        }
    }
}

/**
 * @param {puppeteer.Page} page - The Puppeteer page object.
 */
//Ensures all form fields and critical resources are loaded.
async function ensureFormLoaded(page) {
    logWithTimestamp('Ensuring all form fields are loaded...');
    try {
        await page.waitForSelector('body', { timeout: 30000 });
        const allSelectors = Object.values(config.selectors);
        for (const selector of allSelectors) {
            await page.waitForSelector(selector, { visible: true, timeout: 20000 });
        }
        logWithTimestamp('All form fields loaded successfully.');
    } catch (error) {
        logWithTimestamp(`Error ensuring form loaded: ${error.message}`);
        throw error;
    }
}

/**
 * @param {puppeteer.Page} page - The Puppeteer page object.
 * @param {string} submitButtonSelector - The selector for the submit button.
 * @param {string} screenshotsDir - Directory to store screenshots.
 */
// Submits the form, takes a screenshot, and validates the thank - you page.
async function submitFormAndValidate(page, submitButtonSelector, screenshotsDir) {
    logWithTimestamp('Preparing to submit the form...');
    const screenshotPath = path.join(screenshotsDir, `before_submission_${Date.now()}.png`);
    await page.screenshot({ path: screenshotPath, fullPage: true });
    logWithTimestamp('Screenshot captured before form submission.');

    try {
        await retryClick(page, submitButtonSelector);
        logWithTimestamp('Form submitted, waiting for navigation...');
        logWithTimestamp('-----------------------------------------------------------------------------');
        await page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 30000 });
    } catch (error) {
        logWithTimestamp('Error during form submission:', error.message);
        const errorScreenshotPath = path.join(screenshotsDir, `submission_error_${Date.now()}.png`);
        await page.screenshot({ path: errorScreenshotPath, fullPage: true });
        logWithTimestamp(`Error screenshot saved: ${errorScreenshotPath}`);
        throw error;
    }

    return await validateThankYouPageContent(page, screenshotsDir);
}


/**
 * @param {puppeteer.Page} page - The Puppeteer page object.
 * @param {string} selector - The selector of the element to click.
 * @param {number} retries - Number of retries.
 */
//Retries clicking an element multiple times in case of failure.
async function retryClick(page, selector, retries = 3) {
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            logWithTimestamp(`Attempt ${attempt}: Clicking on Request a call back button (${selector}).`);
            await page.waitForSelector(selector, { visible: true, timeout: 10000 });
            await page.click(selector);
            logWithTimestamp(`Click successful on attempt ${attempt} for ${selector} .`);
            return;
        } catch (error) {
            logWithTimestamp(`Attempt ${attempt} failed for ${selector}: ${error.message}`);
            if (attempt === retries) {
                logWithTimestamp(`All ${retries} attempts to click ${selector} failed.`);
                throw error;
            }
        }
    }
}

// Validates the thank - you page by checking the page URL and its content.
/**
 * @param {puppeteer.Page} page - The Puppeteer page object.
 * @param {string} screenshotsDir - Directory to store error screenshots.
 * @returns {boolean} - Returns true if the thank-you page is validated.
 */
async function validateThankYouPageContent(page, screenshotsDir) {
    const currentURL = page.url();
    logWithTimestamp(`Current URL: ${currentURL}`);
    if (currentURL.includes(config.thankYouPage)) {
        logWithTimestamp('Thank you page reached successfully.');
        return true;
    }

    try {
        const pageContent = await page.evaluate(() => document.body.innerText);
        if (config.thankYouText.every(text => pageContent.includes(text))) {
            logWithTimestamp('Thank you page content validated successfully.');
            return true;
        } else {
            logWithTimestamp('Content validation failed. Some expected text is missing.');
        }
    } catch (error) {
        logWithTimestamp('Error validating page content:', error.message);
        throw new Error('Page validation encountered an issue, process terminated.');
    }

    const errorScreenshotPath = path.join(screenshotsDir, `validation_failed_${Date.now()}.png`);
    await page.screenshot({ path: errorScreenshotPath, fullPage: true });
    logWithTimestamp(`Screenshot saved for validation failure: ${errorScreenshotPath}`);
    return false;
}


/**
 * Main automation function to run the entire form interaction process.
 * Initializes the browser, loads the form, fills it, submits it, and handles the submission response.
 */
async function runAutomation() {
    logWithTimestamp('Starting automation...');
    const browser = await puppeteer.launch({ headless: false });
    const page = (await browser.pages())[0] || await browser.newPage();

    try {
        await page.goto(config.formUrl);
        logWithTimestamp('Navigated to form URL.');

        const screenshotsDir = path.join(__dirname, 'screenshots');
        await ensureDirectoryExists(screenshotsDir);

        await ensureFormLoaded(page);

        const formData = {
            [config.selectors.name]: 'Eden Oved',
            [config.selectors.email]: 'edenoved.swe@gmail.com',
            [config.selectors.phone]: '+972 54-324-1555',
            [config.selectors.company]: 'Jones Software'
        };

        // Validate form data before filling fields
        const validationErrors = validateFormData(formData);
        if (validationErrors.length > 0) {
            logWithTimestamp('Form validation failed. Errors:');
            validationErrors.forEach(error => logWithTimestamp(error));
            return; // Stop execution if validation fails
        }

        await fillFormFields(page, formData);

        logWithTimestamp('Changing the number of employees to 51-500...');
        await page.select(config.selectors.employees, '51-500');

        const submissionSuccess = await submitFormAndValidate(page, config.selectors.submitButton, screenshotsDir);
        if (submissionSuccess) {
            logWithTimestamp('Form successfully submitted and validated.');
        } else {
            logWithTimestamp('Form submission failed.');
        }

        logWithTimestamp('Automation completed. Press ENTER to exit and close the browser.');
        /**
        * Cleanup function to close the browser and exit the script.
        * Prompts the user to press ENTER to close the application.
        */
        const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
        rl.question('Press ENTER to exit and close the browser...', async () => {
            rl.close();
            await browser.close();
            logWithTimestamp('Browser closed. Exiting script.');
        });

    } catch (error) {
        logWithTimestamp(`Error during automation: ${error.message}`);
        await browser.close();
        process.exit(1);
    }
}

runAutomation().catch(async error => {
    logWithTimestamp(`Unhandled error: ${error.message}`);
    await browser.close();
    process.exit(1);
});

