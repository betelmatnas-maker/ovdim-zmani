const puppeteer = require("puppeteer-core");
const chromium = require("@sparticuz/chromium");

// Renders an HTML string to a PDF Buffer using a headless Chromium instance.
// Uses @sparticuz/chromium so it works on most Linux hosts (including
// serverless/managed platforms) without a separate browser install step.
async function htmlToPdfBuffer(html) {
  const executablePath = await chromium.executablePath();
  const browser = await puppeteer.launch({
    args: chromium.args,
    defaultViewport: chromium.defaultViewport,
    executablePath,
    headless: chromium.headless,
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
