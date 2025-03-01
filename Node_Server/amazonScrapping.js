const puppeteer = require('puppeteer');
const axios = require('axios');

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

    // Wait for the redirect to complete and content to load
    await page.waitForNavigation({ waitUntil: 'networkidle2' });
    
    // Extract review content
    const reviews = await page.evaluate(() => {
      const reviewElements = document.querySelectorAll('span[data-hook="review-body"]');
      const reviewsArray = [];
      reviewElements.forEach(reviewElement => {
        reviewsArray.push({ comment: reviewElement.textContent.trim() });
      });
      return reviewsArray;
    });

    // Send JSON data to the API endpoint
    await sendDataToAPI(reviews);

    // Close the browser
    await browser.close();

    // Terminate the process
    process.exit();
  } catch (error) {
    console.error('Error:', error);
    throw error;
  }
}

// Function to wait for CAPTCHA
async function waitForCaptcha(page) {
  // Check if the button associated with solving CAPTCHA exists on the page
  const captchaButton = await page.$('.a-column.a-span6.a-span-last.a-text-right');

  // If the button exists, click on it to proceed
  if (captchaButton) {
    await page.click('.a-column.a-span6.a-span-last.a-text-right');
  }
}

// Function to send JSON data to the API endpoint
async function sendDataToAPI(data) {
  try {
    // Send each comment individually to the API
    for (const review of data) {
      await axios.post('http://127.0.0.1:8000/annotate_comments_json/', review);
    }
    console.log('JSON data sent to the API successfully.');
  } catch (error) {
    console.error('Error sending JSON data to the API:', error);
    throw error;
  }
}

// Example usage:
const productUrl = 'https://www.amazon.com/UtechSmart-transmission-technology-Ergonomic-programmable/product-reviews/B07XP4K152/ref=cm_cr_dp_d_show_all_btm?ie=UTF8&reviewerType=all_reviews';
scrapeAmazonReviews(productUrl)
  .then(() => {
    // This block will never be reached since we're exiting the process
  })
  .catch(error => {
    console.error('Scraping failed:', error);
  });

module.exports = scrapeAmazonReviews;
