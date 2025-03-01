const puppeteer = require('puppeteer');

(async () => {
  // Launch a new browser instance
  const browser = await puppeteer.launch();

  // Open a new page
  const page = await browser.newPage();

  try {
    // Navigate to the website you want to scrape
    await page.goto('https://www.justwatch.com/us/movie/the-legend-of-maula-jatt')
    // Wait for the page to load completely


    // Extract data
    const data = await page.evaluate(() => {
      const reviewTexts = Array.from(document.querySelectorAll('.review-text')); // Select all elements with class .review-text
      return reviewTexts.map(review => ({
        text: review.textContent.trim() // Get the text content of the review and remove leading/trailing whitespaces
      }));
    });

    // Log the extracted data
    console.log(data);
  } catch (error) {
    console.error('Error:', error);
  } finally {
    // Close the browser
    await browser.close();
  }
})();
