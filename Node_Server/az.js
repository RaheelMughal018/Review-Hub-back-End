const puppeteer = require('puppeteer');
const axios = require('axios');

// Function to handle navigation to the login page and login process
async function handleLoginPage(page) {
  try {
    // Wait for the email input field to appear
    await page.waitForSelector('#ap_email');

    // Fill the email input field with the desired email address
    await page.type('#ap_email', 'furqana405@gmail.com');

    // Wait for the password input field to appear
    await page.waitForSelector('#ap_password');

    // Fill the password input field with the desired password
    await page.type('#ap_password', 'qwerty11223344');

    // Click on the login button to proceed
    await page.click('#signInSubmit');
  } catch (error) {
    console.error('Error handling login page:', error);
    throw error;
  }
}

// Function to scrape Amazon reviews
// Function to scrape Amazon reviews
async function scrapeAmazonReviews(url) {
  try {
    const browser = await puppeteer.launch({ headless: false });
    const page = await browser.newPage();

    // Set a custom User-Agent string
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');

    // Navigate to the Amazon product page
    await page.goto(url, { waitUntil: 'networkidle2' });

    // Wait for user to solve CAPTCHA manually
    await waitForCaptcha(page);

    // Check if navigation occurred after solving CAPTCHA
    const redirectedUrl = page.url();
    if (redirectedUrl !== url) {
      // If navigation occurred, handle the login page again
      await handleLoginPage(page);

      // Wait for the redirect to complete and content to load
      await page.waitForNavigation({ waitUntil: 'networkidle2' });
    }

    // Scrape reviews from the first page and subsequent pages
    await scrapePages(page);

    // Close the browser
    await browser.close();
  } catch (error) {
    console.error('Error:', error);
    throw error;
  }
}


// Function to scrape reviews from the current page and subsequent pages
async function scrapePages(page) {
  try {
    // Scrape reviews from the current page
    await scrapeReviews(page);

    // Check if there's a "Next" button
    const nextButton = await page.$('.a-last > a');

    // If there's a "Next" button, click on it and scrape the next page
    if (nextButton) {
      console.log('Clicking on the "Next" button...');
      await nextButton.click();
      await page.waitForNavigation({ waitUntil: 'networkidle2' });

      // Handle navigation to the login page and login process
      await handleLoginPage(page);

      // Scroll to the top of the page
      await page.evaluate(() => {
        window.scrollTo(0, 0);
      });

      // Scrape reviews from the next page (recursive call)
      await scrapePages(page);
    } else {
      console.log('No more pages available.');
    }
  } catch (error) {
    console.error('Error scraping pages:', error);
    throw error;
  }
}

// Function to scrape reviews from the current page
async function scrapeReviews(page) {
  try {
    console.log('Scraping reviews from the current page...');

    // Extract review content
    const reviews = await page.evaluate(() => {
      const reviewElements = document.querySelectorAll('span[data-hook="review-body"]');
      const reviewsArray = [];
      reviewElements.forEach(reviewElement => {
        reviewsArray.push({ comment: reviewElement.textContent.trim() });
      });
      return reviewsArray;
    });

    console.log('Found', reviews.length, 'reviews on this page:', reviews);

    // Send JSON data to the API endpoint
    await sendDataToAPI(reviews);
  } catch (error) {
    console.error('Error scraping reviews:', error);
    throw error;
  }
}

// Function to wait for CAPTCHA
async function waitForCaptcha(page) {
  const captchaButton = await page.$('.a-column.a-span6.a-span-last.a-text-right');
  if (captchaButton) {
    await page.click('.a-column.a-span6.a-span-last.a-text-right');
  }
}

// Function to send JSON data to the API endpoint
async function sendDataToAPI(data) {
  try {
    // Concatenate all comments into a single string
    const commentsString = data.map(review => review.comment).join(', ');

    // Create an object with the concatenated comments
    const jsonData = { comment: commentsString };
    console.log(jsonData)
    // Send the JSON data to the API
   // await axios.post(jsonData);

    console.log('JSON data sent to the API successfully.');
  } catch (error) {
    console.error('Error sending JSON data to the API:', error);
    throw error;
  }
}

// Example usage:
const productUrl = 'https://www.amazon.com/GTPLAYER-LR002-2024-Gaming-Chair-Black/product-reviews/B0CW1DDNNH/ref=cm_cr_dp_d_show_all_btm?ie=UTF8&reviewerType=all_reviews';
scrapeAmazonReviews(productUrl)
  .then(() => {
    // This block will never be reached since we're exiting the process
  })
  .catch(error => {
    console.error('Scraping failed:', error);
  });

module.exports = scrapeAmazonReviews;
