const puppeteer = require("puppeteer");

// Renders an HTML string to a PDF Buffer using a headless Chromium instance
// bundled with the `puppeteer` package (broadly compatible with standard
// Linux hosts like Render, unlike the Lambda-optimized sparticuz/chromium).
async function htmlToPdfBuffer(html) {
  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });
    const buffer = await page.pdf({ format: "A4", printBackground: true });
    return buffer;
  } finally {
    await browser.close();
  }
}

module.exports = { htmlToPdfBuffer };
