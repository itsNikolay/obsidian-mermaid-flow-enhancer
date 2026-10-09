const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests/integration',
  timeout: 30000,
  workers: 1,
  use: { browserName: 'chromium', headless: true },
});
