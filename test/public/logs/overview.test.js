/**
 * @license
 * Copyright CERN and copyright holders of ALICE O2. This software is
 * distributed under the terms of the GNU General Public License v3 (GPL
 * Version 3), copied verbatim in the file "COPYING".
 *
 * See http://alice-o2.web.cern.ch/license for full licensing information.
 *
 * In applying this license CERN does not waive the privileges and immunities
 * granted to it by virtue of its status as an Intergovernmental Organization
 * or submit itself to any jurisdiction.
 */

const chai = require('chai');
const puppeteer = require('puppeteer');
const pti = require('puppeteer-to-istanbul');
const { server } = require('../../../lib/application');

const { expect } = chai;

/**
 * Special method built due to Puppeteer limitations: looks for the first row matching an ID in a table
 * @param {Object} table An HTML element representing the entire log table
 * @param {Object} page An object representing the browser page being used by Puppeteer
 * @return {Promise<String>} The ID of the first matching row with data
 */
async function getFirstRow(table, page) {
    for await (const child of table) {
        const id = await page.evaluate((element) => element.id, child);
        if (id.startsWith('row')) {
            return id;
        }
    }
}

/**
 * Special method built to gather all currently visible table entities from a specific column into an array
 * @param {Object} page An object representing the browser page being used by Puppeteer
 * @param {String} key The key for the column to gather entities of
 * @return {Promise<Array>} An array containing all table entities of a column, in the order displayed by the browser
 */
async function getAllDataFields(page, key) {
    const allData = await page.$$('td');
    return await allData.reduce(async (accumulator, data) => {
        const id = await page.evaluate((element) => element.id, data);
        if (id.endsWith(`-${key}`)) {
            const text = await page.evaluate((element) => element.innerText, data);
            (await accumulator).push(text);
        }
        return accumulator;
    }, []);
}

module.exports = () => {
    let page;
    let browser;
    let url;

    let originalNumberOfRows;
    let table;
    let firstRowId;
    let parsedFirstRowId;

    before(async () => {
        browser = await puppeteer.launch({ args: ['--no-sandbox'] });
        page = await browser.newPage();
        await Promise.all([
            page.coverage.startJSCoverage({ resetOnNavigation: false }),
            page.coverage.startCSSCoverage(),
        ]);
        page.setViewport({
            width: 700,
            height: 720,
            deviceScaleFactor: 1,
        });

        const { port } = server.address();
        url = `http://localhost:${port}`;
    });

    after(async () => {
        const [jsCoverage, cssCoverage] = await Promise.all([
            page.coverage.stopJSCoverage(),
            page.coverage.stopCSSCoverage(),
        ]);

        pti.write([...jsCoverage, ...cssCoverage].filter(({ url = '' } = {}) => url.match(/\.(js|css)$/)));
        await browser.close();
    });

    it('loads the page successfully', async () => {
        const response = await page.goto(url);
        await page.waitFor(100);

        // We expect the page to return the correct status code, making sure the server is running properly
        expect(response.status()).to.equal(200);

        // We expect the page to return the correct title, making sure there isn't another server running on this port
        const title = await page.title();
        expect(title).to.equal('AliceO2 Bookkeeping 2020');
    });

    it('can filter by log title', async () => {
        // Expect the page to have loaded enough rows to be able to test the filtering
        const originalRows = await page.$$('table tr');
        originalNumberOfRows = originalRows.length - 1;
        expect(originalNumberOfRows).to.be.greaterThan(1);

        // Open the title filter
        await page.click('#titleFilterToggle');
        await page.waitFor(100);

        // Insert some text into the filter
        await page.type('#titleFilterText', 'entry');
        await page.waitFor(500);

        // Expect the (new) total number of rows to be less than the original number of rows
        const firstFilteredRows = await page.$$('table tr');
        const firstFilteredNumberOfRows = firstFilteredRows.length - 1;
        expect(firstFilteredNumberOfRows).to.be.lessThan(originalNumberOfRows);

        // Insert some other text into the filter
        await page.type('#titleFilterText', ' bogusbogusbogus');
        await page.waitFor(500);

        // Expect the table to be empty
        const secondFilteredRows = await page.$$('table tr');
        const secondFilteredNumberOfRows = secondFilteredRows.length - 1;
        expect(secondFilteredNumberOfRows).to.equal(0);

        // Clear the filters
        await page.evaluate(() => {
            // eslint-disable-next-line no-undef
            model.logs.resetLogsParams();
        });
        await page.waitFor(100);

        // Expect the total number of rows to once more equal the original total
        const unfilteredRows = await page.$$('table tr');
        const unfilteredNumberOfRows = unfilteredRows.length - 1;
        expect(unfilteredNumberOfRows).to.equal(originalNumberOfRows);

        // Close the created at filters now that we are done with them
        await page.click('#titleFilterToggle');
        await page.waitFor(100);
    });

    it('can filter by log author', async () => {
        // Expect the page to have loaded enough rows to be able to test the filtering
        const originalRows = await page.$$('table tr');
        originalNumberOfRows = originalRows.length - 1;
        expect(originalNumberOfRows).to.be.greaterThan(1);

        // Open the author filter
        await page.click('#authorFilterToggle');
        await page.waitFor(100);

        // Insert some text into the filter
        await page.type('#authorFilterText', 'John');
        await page.waitFor(500);

        // Expect the (new) total number of rows to be less than the original number of rows
        const firstFilteredRows = await page.$$('table tr');
        const firstFilteredNumberOfRows = firstFilteredRows.length - 1;
        expect(firstFilteredNumberOfRows).to.be.lessThan(originalNumberOfRows);

        // Insert some other text into the filter
        await page.type('#authorFilterText', ' DoesNotExist');
        await page.waitFor(500);

        // Expect the table to be empty
        const secondFilteredRows = await page.$$('table tr');
        const secondFilteredNumberOfRows = secondFilteredRows.length - 1;
        expect(secondFilteredNumberOfRows).to.equal(0);

        // Clear the filters
        await page.evaluate(() => {
            // eslint-disable-next-line no-undef
            model.logs.resetLogsParams();
        });
        await page.waitFor(100);

        // Expect the total number of rows to once more equal the original total
        const unfilteredRows = await page.$$('table tr');
        const unfilteredNumberOfRows = unfilteredRows.length - 1;
        expect(unfilteredNumberOfRows).to.equal(originalNumberOfRows);

        // Close the created at filters now that we are done with them
        await page.click('#authorFilterToggle');
        await page.waitFor(100);
    });

    it('can filter by creation date', async () => {
        // Open the created at filters
        await page.click('#createdAtFilterToggle');
        await page.waitFor(100);

        // Insert a minimum date into the filter
        await page.focus('#createdFilterFrom');
        await page.waitFor(100);
        await page.type('#createdFilterFrom', '01012020');
        await page.waitFor(100);

        // Expect the (new) total number of rows to be less than the original number of rows
        const firstFilteredRows = await page.$$('table tr');
        const firstFilteredNumberOfRows = firstFilteredRows.length - 1;
        expect(firstFilteredNumberOfRows).to.be.lessThan(originalNumberOfRows);

        // Insert a maximum date into the filter
        await page.focus('#createdFilterTo');
        await page.waitFor(100);
        await page.type('#createdFilterTo', '01022020');
        await page.waitFor(100);

        // Expect the table to be empty
        const secondFilteredRows = await page.$$('table tr');
        const secondFilteredNumberOfRows = secondFilteredRows.length - 1;
        expect(secondFilteredNumberOfRows).to.equal(0);

        // Insert a maximum date into the filter that is invalid
        await page.focus('#createdFilterTo');
        await page.waitFor(100);
        await page.type('#createdFilterTo', '01012000');
        await page.waitFor(100);

        // Do not expect anything to change, as this maximum is below the minimum, therefore the API is not called
        const thirdFilteredRows = await page.$$('table tr');
        const thirdFilteredNumberOfRows = thirdFilteredRows.length - 1;
        expect(thirdFilteredNumberOfRows).to.equal(secondFilteredNumberOfRows);

        // Clear the filters
        await page.evaluate(() => {
            // eslint-disable-next-line no-undef
            model.logs.resetLogsParams();
        });
        await page.waitFor(100);

        // Close the title filter now that we are done with it
        await page.click('#createdAtFilterToggle');
        await page.waitFor(100);
    });

    it('can filter by tags', async () => {
        // Open the tag filters
        await page.click('#tagsFilterToggle');
        await page.waitFor(100);

        // Select the first available filter and wait for the changes to be processed
        const firstCheckboxId = 'tagCheckbox1';
        await page.click(`#${firstCheckboxId}`);
        await page.waitFor(100);

        // Expect the (new) total number of rows to be less than the original number of rows
        const firstFilteredRows = await page.$$('table tr');
        const firstFilteredNumberOfRows = firstFilteredRows.length - 1;
        expect(firstFilteredNumberOfRows).to.be.lessThan(originalNumberOfRows);

        // Deselect the filter and wait for the changes to process
        await page.click(`#${firstCheckboxId}`);
        await page.waitFor(100);

        // Expect the total number of rows to equal the original total
        const firstUnfilteredRows = await page.$$('table tr');
        expect(firstUnfilteredRows.length - 1).to.equal(originalNumberOfRows);

        // Select the first two available filters at once
        const secondCheckboxId = 'tagCheckbox2';
        await page.click(`#${firstCheckboxId}`);
        await page.waitFor(100);
        await page.click(`#${secondCheckboxId}`);
        await page.waitFor(100);

        // Expect the table to be empty
        const secondFilteredRows = await page.$$('table tr');
        const secondFilteredNumberOfRows = secondFilteredRows.length - 1;
        expect(secondFilteredNumberOfRows).to.equal(0);

        // Set the filter operation to "OR"
        await page.click('#tagFilterOperationRadioButtonOR');
        await page.waitFor(100);

        // Expect there now to be more rows than both the previous table and the table with only one filter
        const thirdFilteredRows = await page.$$('table tr');
        const thirdFilteredNumberOfRows = thirdFilteredRows.length - 1;
        expect(thirdFilteredNumberOfRows).to.be.greaterThan(firstFilteredNumberOfRows);
        expect(thirdFilteredNumberOfRows).to.be.greaterThan(secondFilteredNumberOfRows);

        // Clear the filters
        await page.evaluate(() => {
            // eslint-disable-next-line no-undef
            model.logs.resetLogsParams();
        });
    });

    it('can show and hide extra tags if available', async () => {
        const TAGS_LIMIT = 5;
        const buttonId = '#toggleMoreTags';

        // Open the tag filters again
        await page.click('#tagsFilterToggle');
        await page.waitFor(100);

        // Expect the page to have a button allowing for showing more tags
        const toggleFiltersButton = await page.$(buttonId);
        let buttonText = await page.evaluate((element) => element.innerText, toggleFiltersButton);
        expect(buttonText.trim()).to.equal('More tags');

        // Expect the button to show at least one extra tag when clicked
        await page.click(buttonId);
        await page.waitFor(100);
        let extraTagFilter = await page.$(`#tagCheckbox${TAGS_LIMIT + 1}`);
        expect(Boolean(extraTagFilter)).to.be.true;

        // Expect the text to change to reflect the newly shown tags
        buttonText = await page.evaluate((element) => element.innerText, toggleFiltersButton);
        expect(buttonText.trim()).to.equal('Less tags');

        // Expect the button to remove the extra tag when clicked again
        await page.click(buttonId);
        await page.waitFor(100);
        extraTagFilter = await page.$(`#tagCheckbox${TAGS_LIMIT + 1}`);
        expect(Boolean(extraTagFilter)).to.be.false;

        // Close the tag filters now that we are done with them
        await page.click('#tagsFilterToggle');
        await page.waitFor(100);
    });

    it('can sort by columns in ascending and descending manners', async () => {
        // Expect a sorting preview to appear when hovering over a column header
        await page.hover('th#title');
        await page.waitFor(100);
        const sortingPreviewIndicator = await page.$('#title-sort-preview');
        expect(Boolean(sortingPreviewIndicator)).to.be.true;

        // Sort by log title in an ascending manner
        const titleHeader = await page.$('th#title');
        await titleHeader.evaluate((button) => button.click());
        await page.waitFor(200);

        // Expect the log titles to be in alphabetical order
        const firstTitles = await getAllDataFields(page, 'title');
        expect(firstTitles).to.deep.equal(firstTitles.sort());
        await page.waitFor(100);
        const sortingIndicator = await page.$('#title-sort');
        expect(Boolean(sortingIndicator)).to.be.true;

        // Toggle to sort this towards reverse alphabetical order
        await titleHeader.evaluate((button) => button.click());
        await page.waitFor(200);

        // Expect the log titles to be in reverse alphabetical order
        const secondTitles = await getAllDataFields(page, 'title');
        expect(secondTitles).to.deep.equal(secondTitles.sort((a, b) => b.localeCompare(a)));

        // Toggle to clear this sorting
        await titleHeader.evaluate((button) => button.click());
        await page.waitFor(200);

        // Expect the log titles to no longer be sorted in any way
        const thirdTitles = await getAllDataFields(page, 'title');
        expect(thirdTitles).to.not.deep.equal(firstTitles);
        expect(thirdTitles).to.not.deep.equal(secondTitles);

        // Sort by log author in ascending manner
        const authorHeader = await page.$('th#author');
        await authorHeader.evaluate((button) => button.click());
        await page.waitFor(200);

        // Expect the authors to be in alphabetical order
        const firstAuthors = await getAllDataFields(page, 'author');
        expect(firstAuthors).to.deep.equal(firstAuthors.sort());

        // Sort by creation date in ascending manner
        const createdAtHeader = await page.$('th#createdAt');
        await createdAtHeader.evaluate((button) => button.click());
        await page.waitFor(200);

        // Expect the log author column to be unsorted
        const secondAuthors = await getAllDataFields(page, 'author');
        expect(secondAuthors).to.not.deep.equal(firstAuthors);
    });

    it('shows correct datatypes in respective columns', async () => {
        table = await page.$$('tr');
        firstRowId = await getFirstRow(table, page);

        // Expectations of header texts being of a certain datatype
        const headerDatatypes = {
            title: (title) => typeof title === 'string',
            author: (authorName) => typeof authorName === 'string',
            createdAt: (date) => !isNaN(Date.parse(date)),
            tags: (tags) => typeof tags === 'string' && tags === tags.toUpperCase(),
            replies: (replyCount) => typeof replyCount === 'number' || replyCount === '',
        };

        // We find the headers matching the datatype keys
        const headers = await page.$$('th');
        const headerIndices = {};
        for (const [index, header] of headers.entries()) {
            const headerContent = await page.evaluate((element) => element.id, header);
            const matchingDatatype = Object.keys(headerDatatypes).find((key) => headerContent === key);
            if (matchingDatatype !== undefined) {
                headerIndices[index] = matchingDatatype;
            }
        }

        // We expect every value of a header matching a datatype key to actually be of that datatype
        const firstRowCells = await page.$$(`#${firstRowId} td`);
        for (const [index, cell] of firstRowCells.entries()) {
            if (Object.keys(headerIndices).includes(index)) {
                const cellContent = await page.evaluate((element) => element.innerText, cell);
                const expectedDatatype = headerDatatypes[headerIndices[index]](cellContent);
                expect(expectedDatatype).to.be.true;
            }
        }
    });

    it('can set how many logs are available per page', async () => {
        // Expect the amount selector to currently be set to 10 pages
        const amountSelectorId = '#amountSelector';
        const amountSelectorButton = await page.$(`${amountSelectorId} button`);
        const amountSelectorButtonText = await page.evaluate((element) => element.innerText, amountSelectorButton);
        expect(amountSelectorButtonText.endsWith('10 ')).to.be.true;

        // Expect the dropdown options to be visible when it is selected
        await amountSelectorButton.evaluate((button) => button.click());
        await page.waitFor(100);
        const amountSelectorDropdown = await page.$(`${amountSelectorId} .dropdown-menu`);
        expect(Boolean(amountSelectorDropdown)).to.be.true;

        // Expect the amount of visible logs to reduce when the first option (5) is selected
        const menuItem = await page.$(`${amountSelectorId} .dropdown-menu .menu-item`);
        await menuItem.evaluate((button) => button.click());
        await page.waitFor(100);

        const tableRows = await page.$$('table tr');
        expect(tableRows.length - 1).to.equal(5);
    });

    it('can switch between pages of logs', async () => {
        // Expect the page selector to be available with two pages
        const pageSelectorId = '#amountSelector';
        const pageSelector = await page.$(pageSelectorId);
        expect(Boolean(pageSelector)).to.be.true;
        const pageSelectorButtons = await page.$$('#pageSelector .btn-tab');
        expect(pageSelectorButtons.length).to.equal(2);

        // Expect the table rows to change upon page navigation
        const oldFirstRowId = await getFirstRow(table, page);
        const secondPage = await page.$('#page2');
        await secondPage.evaluate((button) => button.click());
        await page.waitFor(100);
        table = await page.$$('tr');
        const newFirstRowId = await getFirstRow(table, page);
        expect(oldFirstRowId).to.not.equal(newFirstRowId);

        // Expect us to be able to do the same with the page arrows
        const prevPage = await page.$('#pageMoveLeft');
        await prevPage.evaluate((button) => button.click());
        await page.waitFor(100);
        const oldFirstPageButton = await page.$('#page1');
        const oldFirstPageButtonClass = await page.evaluate((element) => element.className, oldFirstPageButton);
        expect(oldFirstPageButtonClass).to.include('selected');

        // The same, but for the other (right) arrow
        const nextPage = await page.$('#pageMoveRight');
        await nextPage.evaluate((button) => button.click());
        await page.waitFor(100);
        const newFirstPageButton = await page.$('#page1');
        const newFirstPageButtonClass = await page.evaluate((element) => element.className, newFirstPageButton);
        expect(newFirstPageButtonClass).to.not.include('selected');
    });

    it('dynamically switches between visible pages in the page selector', async () => {
        // Override the amount of logs visible per page manually
        await page.evaluate(() => {
            // eslint-disable-next-line no-undef
            model.logs.setLogsPerPage(1);
        });
        await page.waitFor(100);

        // Expect the page five button to now be visible, but no more than that
        const pageFiveButton = await page.$('#page5');
        expect(Boolean(pageFiveButton)).to.be.true;
        const pageSixButton = await page.$('#page6');
        expect(Boolean(pageSixButton)).to.be.false;

        // Expect the page one button to have fallen away when clicking on page five button
        await page.click('#page5');
        await page.waitFor(100);
        const pageOneButton = await page.$('#page1');
        expect(Boolean(pageOneButton)).to.be.false;

        // Revert changes for next test
        await page.evaluate(() => {
            // eslint-disable-next-line no-undef
            model.logs.setLogsPerPage(10);
        });
    });

    it('can navigate to the log creation page', async () => {
        // Click on the button to start creating a new log
        await page.click('#create');
        await page.waitFor(500);

        // Expect the page to be the log creation page at this point
        const redirectedUrl = await page.url();
        expect(redirectedUrl).to.equal(`${url}/?page=log-create`);
    });

    it('notifies if table loading returned an error', async () => {
        // Go back to the home page
        await page.click('#log-overview');
        await page.waitFor(100);

        /*
         * As an example, override the amount of logs visible per page manually
         * We know the limit is 100 as specified by the Dto
         */
        await page.evaluate(() => {
            // eslint-disable-next-line no-undef
            model.logs.setLogsPerPage(200);
        });
        await page.waitFor(100);

        // We expect there to be a fitting error message
        const error = await page.$('.alert-danger');
        expect(Boolean(error)).to.be.true;
        const message = await page.evaluate((element) => element.innerText, error);
        expect(message).to.equal('Invalid Attribute: "query.page.limit" must be less than or equal to 100');

        // Revert changes for next test
        await page.evaluate(() => {
            // eslint-disable-next-line no-undef
            model.logs.setLogsPerPage(10);
        });
        await page.waitFor(100);
    });

    it('can navigate to a log detail page', async () => {
        // Go back to the home page
        await page.click('#log-overview');
        await page.waitFor(100);

        parsedFirstRowId = parseInt(firstRowId.slice('row'.length, firstRowId.length), 10);

        // We expect the entry page to have the same id as the id from the log overview
        const row = await page.$(`tr#${firstRowId}`);
        await row.evaluate((row) => row.click());
        await page.waitFor(500);

        const redirectedUrl = await page.url();
        expect(redirectedUrl).to.equal(`${url}/?page=log-detail&id=${parsedFirstRowId}`);
    });

    it('does not reset pagination filters when navigating away', async () => {
        // Go back to the home page
        const homeButton = await page.$('#log-overview');
        await homeButton.evaluate((button) => button.click());
        await page.waitFor(500);

        // Override the amount of logs visible per page manually
        await page.evaluate(() => {
            // eslint-disable-next-line no-undef
            model.logs.setLogsPerPage(1);
        });
        await page.waitFor(100);

        // Go to the second page of "logs"
        const secondPageButton = await page.$('#page2');
        await secondPageButton.evaluate((button) => button.click());
        await page.waitFor(100);

        // Navigate to a log detail page
        table = await page.$$('tr');
        firstRowId = await getFirstRow(table, page);
        const row = await page.$(`tr#${firstRowId}`);
        await row.evaluate((row) => row.click());
        await page.waitFor(500);

        // Go back to the home page again
        await page.goBack();
        await page.waitFor(100);

        // Expect the pagination to still be on page two
        const firstPageButton = await page.$('#page1');
        const firstPageButtonClass = await page.evaluate((element) => element.className, firstPageButton);
        const secondPageButtonClass = await page.evaluate((element) => element.className, secondPageButton);
        expect(firstPageButtonClass).to.not.include('selected');
        expect(secondPageButtonClass).to.include('selected');
    });
};
