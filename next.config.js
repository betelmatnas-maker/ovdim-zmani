/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // puppeteer-core / @sparticuz/chromium ship native binaries that Next.js's
  // server bundler should not try to process - keep them external.
  webpack: (config) => {
    config.externals = [...(config.externals || []), "puppeteer-core", "@sparticuz/chromium"];
    return config;
  },
};

module.exports = nextConfig;
