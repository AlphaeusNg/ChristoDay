import { expect, test } from "@playwright/test";

const runtimeErrors = new WeakMap();

test.beforeEach(async ({ page }) => {
  const errors = [];
  runtimeErrors.set(page, errors);
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`console: ${message.text()}`);
  });

  await page.route(/^https:\/\//, async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const bibleRequest = /^\/get-text\/([^/]+)\/(\d+)\/(\d+)\/?$/.exec(url.pathname);
    if (url.hostname === "bolls.life" && bibleRequest) {
      const [, translation, bookId, chapter] = bibleRequest;
      if (translation === "NIV" && bookId === "41" && chapter === "1") {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
      const verses = Array.from({ length: 120 }, (_, index) => ({
        verse: index + 1,
        text: `<b>${translation}</b> book ${bookId} chapter ${chapter} verse ${index + 1}`,
      }));
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(verses),
      });
      return;
    }

    const resourceType = request.resourceType();
    const contentType = resourceType === "stylesheet"
      ? "text/css"
      : resourceType === "document"
        ? "text/html"
        : "application/javascript";
    await route.fulfill({ status: 200, contentType, body: "" });
  });
});

test.afterEach(async ({ page }) => {
  await page.waitForTimeout(100);
  expect(runtimeErrors.get(page), "unexpected browser runtime errors").toEqual([]);
});

test("boots, navigates, and keeps the newest translation", async ({ page }) => {
  await page.goto("./", { waitUntil: "domcontentloaded" });
  await expect(page.locator("#site-version")).not.toHaveText("—");
  await expect(page.locator("#fatal")).toBeHidden();

  const datePicker = page.locator("#date-pick");
  await datePicker.fill("2026-06-16");
  await datePicker.dispatchEvent("change");

  await expect(page.locator("#reading-panel")).toBeVisible();
  await expect(page.locator("#passage-ref")).toHaveText("Matthew 1:1-17");
  await expect(page.locator("#passage-tr-label")).toHaveText("NIV");
  await expect(page.locator("#passage-body")).toContainText("NIV book 40 chapter 1 verse 1");

  const slowNivRequest = page.waitForRequest((request) =>
    request.url().includes("/get-text/NIV/41/1/")
  );
  await page.locator("#btn-next").click();
  await slowNivRequest;
  await expect(datePicker).toHaveValue("2026-06-17");
  await expect(page.locator("#passage-ref")).toHaveText("Mark 1:1-8");

  await page.locator("#translation").selectOption("ESV");
  await expect(page.locator("#passage-tr-label")).toHaveText("ESV");
  await expect(page.locator("#passage-body")).toContainText("ESV book 41 chapter 1 verse 1");

  await page.waitForTimeout(600);
  await expect(page.locator("#passage-tr-label")).toHaveText("ESV");
  await expect(page.locator("#passage-body")).toContainText("ESV book 41 chapter 1 verse 1");
  await expect(page.locator("#passage-status")).toBeHidden();

  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("christoday.v1")));
  expect(saved.translation).toBe("ESV");
  expect(saved.days["2026-06-17"].translation).toBe("ESV");
});

test("keeps reading progress visible and reports denied device saves", async ({ page }) => {
  await page.addInitScript(() => {
    const originalSetItem = Storage.prototype.setItem;
    window.__christoStateWritesAllowed = false;
    Storage.prototype.setItem = function setItem(key, value) {
      if (key === "christoday.v1" && !window.__christoStateWritesAllowed) {
        throw new DOMException("storage denied", "QuotaExceededError");
      }
      return originalSetItem.call(this, key, value);
    };
  });

  await page.goto("./", { waitUntil: "domcontentloaded" });
  const datePicker = page.locator("#date-pick");
  const journal = page.locator("#journal");
  const storageStatus = page.locator("#storage-status");
  await datePicker.fill("2026-06-16");
  await datePicker.dispatchEvent("change");
  await expect(page.locator("#passage-ref")).toHaveText("Matthew 1:1-17");

  const firstEntry = "Christ meets me with grace here.";
  await journal.fill(firstEntry);
  await expect(journal).toHaveValue(firstEntry);
  await expect(storageStatus).toBeVisible();
  await expect(storageStatus).toContainText("current entry remains visible");
  await expect(storageStatus).toContainText("may be lost when this tab closes");
  expect(await page.evaluate(() => localStorage.getItem("christoday.v1"))).toBeNull();
  await page.locator("#btn-complete").click();
  await expect(page.locator("#btn-complete")).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("#stat-done")).toHaveText("1");

  await page.locator("#btn-next").click();
  await expect(datePicker).toHaveValue("2026-06-17");
  await expect(journal).toHaveValue("");
  await page.locator("#btn-prev").click();
  await expect(datePicker).toHaveValue("2026-06-16");
  await expect(journal).toHaveValue(firstEntry);
  await expect(page.locator("#btn-complete")).toHaveAttribute("aria-pressed", "true");

  await page.evaluate(() => {
    window.__christoStateWritesAllowed = true;
  });
  const recoveredEntry = `${firstEntry} It is safe now.`;
  await journal.fill(recoveredEntry);
  await expect(storageStatus).toBeHidden();
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("christoday.v1")));
  expect(saved.days["2026-06-16"].journal).toBe(recoveredEntry);
  expect(saved.days["2026-06-16"].completed).toBe(true);
});
