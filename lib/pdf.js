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
    const raw = await page.pdf({ format: "A4", printBackground: true });
    // Puppeteer returns a Uint8Array, not a Node Buffer. Next.js's res.send()
    // only treats real Buffer instances as binary - anything else gets
    // JSON-serialized (producing a garbled, unopenable "PDF"). Wrapping it
    // here guarantees the raw bytes go out untouched.
    return Buffer.from(raw);
  } finally {
    await browser.close();
  }
}

module.exports = { htmlToPdfBuffer };
