'use strict';

// Chạy riêng: NODE_PATH trỏ tới thư mục có playwright, hoặc cài playwright ngoài bộ test mặc định.
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { chromium } = require('playwright');
const { createFixture } = require('./fixture');

async function smoke() {
  const fixture = await createFixture();
  let browser;
  try {
    const register = await fetch(fixture.base + '/api/v1/auth/register', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'browserstudent', password: 'browser-test-123', name: 'Kiểm thử trình duyệt' })
    });
    assert.equal(register.status, 201);
    for (let index = 0; index < 18; index += 1) {
      await fixture.garden.ingestSensors({ temperature: 26 + index / 10, humidity: 60 + index % 8, light: index % 2 }, new Date(Date.now() - (17 - index) * 2000));
    }
    fixture.hardware.on('message', function acknowledge(topic, payload) {
      if (topic === fixture.config.controlTopic) {
        fixture.hardware.publish(fixture.config.responseTopic, payload.toString() + '_ok');
      }
    });
    browser = await chromium.launch({ channel: 'msedge', headless: true });
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const errors = [];
    page.on('pageerror', function collect(error) { errors.push(error.message); });
    page.on('console', function collect(message) {
      if (message.type() === 'error') {
        errors.push(message.text());
      }
    });
    await page.goto(fixture.base);
    await page.locator('#lu').fill('browserstudent');
    await page.locator('#lp').fill('browser-test-123');
    await page.locator('#lb').click();
    await page.waitForSelector('#app:not(.hide)');
    await page.waitForSelector('#c-body svg');
    assert.match(await page.locator('#metrics').innerText(), /DO/);
    assert.equal(await page.locator('[role="tab"][aria-selected="true"]').innerText(), 'Tất cả');
    await page.locator('#tab-temperature').click();
    await page.locator('#tab-all').click();
    await page.locator('.switch[data-d="pump"]').click();
    await page.waitForFunction(function deviceOn() { return SG.state.dev.pump.on && !SG.state.busy; });
    assert.equal(fixture.repository.commands[0].result, 'success');
    await page.locator('[data-p="data"]').click();
    await page.waitForFunction(function hasRows() { return document.querySelectorAll('#d-body tr').length === 10; });
    await page.locator('#d-by').selectOption('temperature');
    await page.locator('#d-q').fill('27');
    await page.waitForFunction(function filtered() { return document.querySelector('#data-count').textContent.startsWith('8 bản ghi'); });
    await page.locator('#d-cl').click();
    await page.waitForFunction(function cleared() { return document.querySelector('#data-count').textContent.startsWith('54 bản ghi'); });
    await page.locator('[data-p="history"]').click();
    await page.waitForSelector('#h-body [data-id]');
    await page.locator('#h-body [data-id]').first().click();
    await page.waitForSelector('#dlg[open]');
    await page.locator('#dlg [data-close]').first().click();
    await page.locator('[data-p="profile"]').click();
    await page.locator('#edit-profile').click();
    await page.locator('#profile-form [name="name"]').fill('Hồ sơ lưu qua API');
    await page.locator('#profile-form [type="submit"]').click();
    await page.waitForFunction(function saved() { return document.querySelector('#prof h2').textContent === 'Hồ sơ lưu qua API'; });
    await page.reload();
    await page.waitForSelector('#app:not(.hide)');
    assert.equal(await page.locator('#side-name').innerText(), 'Hồ sơ lưu qua API');
    const output = path.resolve(__dirname, '../../test-results');
    await fs.mkdir(output, { recursive: true });
    await page.screenshot({ path: path.join(output, 'backend-home.png'), fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForFunction(function sidebarHidden() {
      return document.querySelector('#side').getBoundingClientRect().right <= 1;
    });
    await page.waitForFunction(function chartResized() {
      const svg = document.querySelector('#c-body svg');
      return svg && svg.getBoundingClientRect().width < 390;
    });
    await page.screenshot({ path: path.join(output, 'backend-mobile.png'), fullPage: true });
    const overflow = await page.evaluate(function overflowWidth() {
      return document.documentElement.scrollWidth > window.innerWidth;
    });
    assert.equal(overflow, false);
    await page.locator('#menu').click();
    await page.locator('#logout').click();
    await page.waitForSelector('#auth:not(.hide)');
    assert.deepEqual(errors, []);
    console.log('Browser smoke PASS: login, chart, MQTT control, data filter, history, profile persistence, session restore, mobile, logout.');
  } finally {
    if (browser) {
      await browser.close();
    }
    await fixture.close();
  }
}

smoke().catch(function failed(error) {
  console.error(error);
  process.exitCode = 1;
});
