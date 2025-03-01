const puppeteer = require('puppeteer');
const axios = require('axios');

async function ytscraper(videoUrl) {
  try {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();

    await page.goto(videoUrl, { waitUntil: 'networkidle2' });

    let previousHeight = 0;
    let currentTries = 0;
    const maxTries = 5; // Adjust as needed

    while (currentTries < maxTries) {
      await page.evaluate('window.scrollTo(0, document.documentElement.scrollHeight)');
      await delay(3000); // Adjust delay as needed

      // Check if the scroll height has not changed in the last iteration
      const newHeight = await page.evaluate('document.documentElement.scrollHeight');
      if (newHeight === previousHeight) {
        currentTries++;
      } else {
        currentTries = 0; // Reset tries if scroll height changed
      }

      previousHeight = newHeight;
    }
    const data = await page.evaluate(() => {
      const comments = [];
      document.querySelectorAll('#content-text').forEach(comment => {
        comments.push(comment.textContent.trim());
      }); 
      const commentCountElement = document.querySelector('#count > yt-formatted-string');
      const commentCount = commentCountElement ? parseInt(commentCountElement.textContent.replace(/,/g, '')) : 0;
      return { comments, commentCount };
    });
    await browser.close();
   
    const response = await axios.post('http://127.0.0.1:8000/annotate_comments_json/', {
      comments: data.comments
    });

    return response.data;
  } catch (error) {
    console.error('Error:', error);
    throw error;
  }
}

// Custom delay function
function delay(time) {
  return new Promise((resolve) => {
    setTimeout(resolve, time);
  });
}

module.exports = ytscraper;
