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

test("keeps the reading usable when live passage text fails", async ({ page }) => {
  await page.route(/\/get-text\/NIV\/40\/1\/$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ error: "controlled outage" }),
    });
  });

  await page.goto("./", { waitUntil: "domcontentloaded" });
  const datePicker = page.locator("#date-pick");
  await datePicker.fill("2026-06-16");
  await datePicker.dispatchEvent("change");

  await expect(page.locator("#reading-panel")).toBeVisible();
  await expect(page.locator("#passage-ref")).toHaveText("Matthew 1:1-17");
  await expect(page.locator("#passage-status")).toBeVisible();
  await expect(page.locator("#passage-status")).toContainText(
    "Could not load live text (Bible API returned invalid chapter data).",
  );
  await expect(page.locator("#passage-body")).toContainText("Read: Matthew 1:1-17");
  await expect(page.locator("#passage-body")).toContainText(
    "Offline or blocked networks fall back to the reference only",
  );
  await expect(page.locator("#passage-tr-label")).toHaveText("—");

  await page.locator("#journal").fill("The reference still keeps today's reading usable.");
  await page.locator("#btn-complete").click();
  await expect(page.locator("#btn-complete")).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("#stat-done")).toHaveText("1");

  await page.locator("#translation").selectOption("ESV");
  await expect(page.locator("#passage-status")).toBeHidden();
  await expect(page.locator("#passage-tr-label")).toHaveText("ESV");
  await expect(page.locator("#passage-body")).toContainText("ESV book 40 chapter 1 verse 1");
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

test("shows fatal recovery when the fetched reading plan is invalid", async ({ page }) => {
  await page.route("**/ChristoDay/data/segments.json", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        meta: { startDate: "2026-02-30", timezone: "Asia/Singapore" },
        weekdayMap: { 1: "matthew" },
        books: {},
        reflectionTemplates: {},
      }),
    });
  });

  await page.goto("./", { waitUntil: "domcontentloaded" });

  await expect(page.locator("#fatal")).toBeVisible();
  await expect(page.locator("#fatal")).toHaveText("Could not load reading plan data.");
  await expect(page.locator("#fatal")).toHaveAttribute("role", "alert");
  await expect(page.locator("#site-version")).toHaveText("—");
  await expect(page.locator("#reading-panel")).toBeHidden();
  await expect(page.locator("#passage-ref")).toHaveText("—");

  await page.locator("#date-pick").fill("2026-06-16");
  await page.locator("#date-pick").dispatchEvent("change");
  await expect(page.locator("#reading-panel")).toBeHidden();
  await expect(page.locator("#passage-ref")).toHaveText("—");
  expect(await page.evaluate(() => window.ChristoDayApp.getPlan())).toBeFalsy();

  const errors = runtimeErrors.get(page) || [];
  const expected = [];
  const unexpected = [];
  for (const error of errors) {
    if (/plan load failed|Invalid reading plan/i.test(error)) expected.push(error);
    else unexpected.push(error);
  }
  expect(expected, "invalid plan load must log a developer diagnostic").not.toEqual([]);
  runtimeErrors.set(page, unexpected);
});

test("shows fatal recovery when the plan fetch is not successful", async ({ page }) => {
  await page.route("**/ChristoDay/data/segments.json", async (route) => {
    await route.fulfill({
      status: 404,
      contentType: "text/plain",
      body: "missing segments.json",
    });
  });

  await page.goto("./", { waitUntil: "domcontentloaded" });

  await expect(page.locator("#fatal")).toBeVisible();
  await expect(page.locator("#fatal")).toHaveText("Could not load reading plan data.");
  await expect(page.locator("#fatal")).toHaveAttribute("role", "alert");
  await expect(page.locator("#site-version")).toHaveText("—");
  await expect(page.locator("#reading-panel")).toBeHidden();
  await expect(page.locator("#passage-ref")).toHaveText("—");

  await page.locator("#date-pick").fill("2026-06-16");
  await page.locator("#date-pick").dispatchEvent("change");
  await expect(page.locator("#reading-panel")).toBeHidden();
  await expect(page.locator("#passage-ref")).toHaveText("—");
  expect(await page.evaluate(() => window.ChristoDayApp.getPlan())).toBeFalsy();

  const errors = runtimeErrors.get(page) || [];
  const expected = [];
  const unexpected = [];
  for (const error of errors) {
    if (/plan load failed|HTTP 404|Failed to load resource: the server responded with a status of 404/i.test(error)) {
      expected.push(error);
    } else {
      unexpected.push(error);
    }
  }
  expect(expected, "non-200 plan fetch must log a developer diagnostic").not.toEqual([]);
  expect(
    expected.some((error) => /HTTP 404/.test(error)),
    "non-200 plan fetch must log the HTTP status",
  ).toBe(true);
  runtimeErrors.set(page, unexpected);
});
