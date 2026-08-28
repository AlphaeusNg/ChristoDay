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
  await expect(page.locator("main .hero")).toHaveCount(0);
  await expect(page.locator(".top-nav a[href='#about']")).toBeVisible();
  await expect(page.locator(".top-nav a[href*='http']")).toHaveCount(0);
  await expect(page.locator("#date-pick")).toBeVisible();
  await expect(page.locator("#translation")).toBeVisible();

  const datePicker = page.locator("#date-pick");
  await datePicker.fill("2026-06-16");
  await datePicker.dispatchEvent("change");

  await expect(page.locator("#reading-panel")).toBeVisible();
  await expect(page.locator("#btn-copy")).toBeVisible();
  await expect(page.locator("#btn-share")).toBeVisible();
  await expect(page.locator("#passage-ref")).toHaveText("Matthew 1:1-17");
  await expect(page.locator("#passage-tr-label")).toHaveText("NIV");
  await expect(page.locator("#passage-body")).toContainText("NIV book 40 chapter 1 verse 1");
  await expect(page).toHaveURL(/d=2026-06-16/);

  const slowNivRequest = page.waitForRequest((request) =>
    request.url().includes("/get-text/NIV/41/1/")
  );
  await page.locator("#btn-next").click();
  await slowNivRequest;
  await expect(datePicker).toHaveValue("2026-06-17");
  await expect(page.locator("#passage-ref")).toHaveText("Mark 1:1-8");
  await expect(page).toHaveURL(/d=2026-06-17/);

  await page.locator("#translation").selectOption("ESV");
  await expect(page.locator("#passage-tr-label")).toHaveText("ESV");
  await expect(page.locator("#passage-body")).toContainText("ESV book 41 chapter 1 verse 1");
  await expect(page).toHaveURL(/tr=ESV/);

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

test("resumes the newest unfinished journal even when it is older than 80 weekdays", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem(
      "christoday.v1",
      JSON.stringify({
        translation: "NIV",
        days: {
          "2026-06-16": {
            completed: false,
            journal: "Return to the grace I saw in Matthew.",
            translation: "NIV",
          },
          "2026-06-17": {
            completed: true,
            journal: "A completed later entry should not be resumed.",
            translation: "NIV",
          },
        },
      }),
    );
  });

  await page.goto("./?d=2027-01-15&tr=NIV", { waitUntil: "domcontentloaded" });

  const resume = page.locator("#btn-continue-incomplete");
  await expect(resume).toBeVisible();
  await expect(resume).toHaveText("Continue Tuesday, 16 June 2026");
  await resume.click();
  await expect(page.locator("#date-pick")).toHaveValue("2026-06-16");
  await expect(page.locator("#journal")).toHaveValue("Return to the grace I saw in Matthew.");
});

test("counts completed reading days without impossible saved dates", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem(
      "christoday.v1",
      JSON.stringify({
        translation: "NIV",
        days: {
          "2026-06-15": { completed: true, journal: "A real plan day.", translation: "NIV" },
          "2026-06-20": {
            completed: true,
            journal: "A weekend cannot be completed.",
            translation: "NIV",
          },
          "2026-06-08": {
            completed: true,
            journal: "Before the plan began.",
            translation: "NIV",
          },
        },
      }),
    );
  });

  await page.goto("./?d=2026-06-16&tr=NIV", { waitUntil: "domcontentloaded" });

  await expect(page.locator("#reading-panel")).toBeVisible();
  await expect(page.locator("#stat-done")).toHaveText("1");
  expect(
    await page.evaluate(() => Object.keys(JSON.parse(localStorage.getItem("christoday.v1")).days)),
  ).toEqual(["2026-06-15", "2026-06-20", "2026-06-08"]);
});

test("weekend and pre-start offer the next reading", async ({ page }) => {
  await page.goto("./", { waitUntil: "domcontentloaded" });
  await expect(page.locator("#fatal")).toBeHidden();

  const datePicker = page.locator("#date-pick");
  await datePicker.fill("2026-06-16");
  await datePicker.dispatchEvent("change");
  await page.locator("#btn-complete").click();
  await expect(page.locator("#stat-done")).toHaveText("1");

  await datePicker.fill("2026-06-20");
  await datePicker.dispatchEvent("change");
  await expect(page.locator("#weekend-panel")).toBeVisible();
  await expect(page.locator("#reading-panel")).toBeHidden();
  await expect(page).toHaveURL(/d=2026-06-20/);
  await expect(page.locator("#week-strip [data-ymd='2026-06-16']")).toHaveClass(/is-done/);
  await expect(page.locator("#week-strip [data-ymd='2026-06-17']")).not.toHaveClass(/is-done/);

  await page.locator("#btn-last-friday").click();
  await expect(datePicker).toHaveValue("2026-06-19");
  await expect(page.locator("#reading-panel")).toBeVisible();
  await expect(page.locator("#passage-ref")).toHaveText("Luke 1:1-4");

  await datePicker.fill("2026-06-20");
  await datePicker.dispatchEvent("change");
  await page.locator("#btn-preview-monday").click();
  await expect(datePicker).toHaveValue("2026-06-22");
  await expect(page.locator("#passage-ref")).toHaveText("Jude 1:1-4");

  await datePicker.fill("2026-06-01");
  await datePicker.dispatchEvent("change");
  await expect(page.locator("#before-panel")).toBeVisible();
  await page.locator("#before-panel .js-preview-monday").click();
  await expect(datePicker).toHaveValue("2026-06-15");
  await expect(page.locator("#passage-ref")).toHaveText("Jude 1:1-25");
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

test("shows fatal recovery when the plan response is not JSON", async ({ page }) => {
  await page.route("**/ChristoDay/data/segments.json", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "text/html",
      body: "<!doctype html><title>Unexpected proxy page</title>",
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
    if (/plan load failed|Unexpected token|JSON/i.test(error)) expected.push(error);
    else unexpected.push(error);
  }
  expect(expected, "non-JSON plan response must log a developer diagnostic").not.toEqual([]);
  expect(
    expected.some((error) => /Unexpected token|JSON/i.test(error)),
    "non-JSON plan response must preserve the parse failure in diagnostics",
  ).toBe(true);
  runtimeErrors.set(page, unexpected);
});

function singaporeYmd(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Singapore",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

test("opens a deep-linked date and translation and keeps the URL in sync", async ({ page }) => {
  await page.goto("./?d=2026-06-16&tr=ESV", { waitUntil: "domcontentloaded" });
  await expect(page.locator("#fatal")).toBeHidden();
  await expect(page.locator("#date-pick")).toHaveValue("2026-06-16");
  await expect(page.locator("#translation")).toHaveValue("ESV");
  await expect(page.locator("#reading-panel")).toBeVisible();
  await expect(page.locator("#passage-ref")).toHaveText("Matthew 1:1-17");
  await expect(page.locator("#passage-tr-label")).toHaveText("ESV");
  await expect(page.locator("#passage-body")).toContainText("ESV book 40 chapter 1 verse 1");
  await expect(page).toHaveURL(/d=2026-06-16/);
  await expect(page).toHaveURL(/tr=ESV/);

  await page.locator("#btn-next").click();
  await expect(page.locator("#date-pick")).toHaveValue("2026-06-17");
  await expect(page.locator("#passage-ref")).toHaveText("Mark 1:1-8");
  await expect(page).toHaveURL(/d=2026-06-17/);
  await expect(page).toHaveURL(/tr=ESV/);

  await page.locator("#translation").selectOption("NKJV");
  await expect(page.locator("#passage-tr-label")).toHaveText("NKJV");
  await expect(page).toHaveURL(/d=2026-06-17/);
  await expect(page).toHaveURL(/tr=NKJV/);
});

test("falls back to today when the deep-link date is invalid", async ({ page }) => {
  await page.goto("./?d=2026-02-30&tr=KJV", { waitUntil: "domcontentloaded" });
  const today = singaporeYmd();
  await expect(page.locator("#date-pick")).toHaveValue(today);
  await expect(page.locator("#translation")).toHaveValue("NIV");
  await expect(page).toHaveURL(new RegExp(`d=${today}`));
  await expect(page).not.toHaveURL(/2026-02-30/);
  await expect(page).not.toHaveURL(/tr=KJV/);
  await expect(page).toHaveURL(/tr=NIV/);
});

test("copies the visible passage and shares a dated reading link", async ({ page }) => {
  await page.addInitScript(() => {
    window.__copied = [];
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async (text) => {
          window.__copied.push(text);
        },
        readText: async () => window.__copied[window.__copied.length - 1] || "",
      },
    });
  });

  await page.goto("./?d=2026-06-16&tr=NIV", { waitUntil: "domcontentloaded" });
  await expect(page.locator("#passage-ref")).toHaveText("Matthew 1:1-17");
  await expect(page.locator("#passage-body")).toContainText("NIV book 40 chapter 1 verse 1");

  await page.locator("#btn-copy").click();
  await expect(page.locator("#action-status")).toBeVisible();
  await expect(page.locator("#action-status")).toHaveText("Copied passage.");
  let copied = await page.evaluate(() => window.__copied.at(-1));
  expect(copied).toContain("Matthew 1:1-17");
  expect(copied).toContain("NIV book 40 chapter 1 verse 1");

  await page.keyboard.press("y");
  expect(await page.evaluate(() => window.__copied.length)).toBeGreaterThanOrEqual(2);
  copied = await page.evaluate(() => window.__copied.at(-1));
  expect(copied).toContain("Matthew 1:1-17");

  await page.locator("#btn-share").click();
  await expect(page.locator("#action-status")).toHaveText("Copied today's reading.");
  copied = await page.evaluate(() => window.__copied.at(-1));
  expect(copied).toContain("Tuesday, 16 June 2026");
  expect(copied).toContain("Matthew 1:1-17");
  expect(copied).toMatch(/d=2026-06-16/);
  expect(copied).toMatch(/tr=NIV/);
});

test("uses the Web Share API when it is available", async ({ page }) => {
  await page.addInitScript(() => {
    window.__shares = [];
    navigator.share = async (data) => {
      window.__shares.push(data);
    };
  });

  await page.goto("./?d=2026-06-16&tr=WEB", { waitUntil: "domcontentloaded" });
  await expect(page.locator("#passage-ref")).toHaveText("Matthew 1:1-17");
  await page.locator("#btn-share").click();
  await expect(page.locator("#action-status")).toHaveText("Shared today's reading.");
  const shares = await page.evaluate(() => window.__shares);
  expect(shares).toHaveLength(1);
  expect(shares[0].title).toBe("Matthew 1:1-17");
  expect(shares[0].text).toContain("Matthew 1:1-17");
  expect(shares[0].text).toContain("Tuesday, 16 June 2026");
  expect(shares[0].url).toMatch(/d=2026-06-16/);
  expect(shares[0].url).toMatch(/tr=WEB/);
});

test("reads aloud, stops, and resets after completion or speech errors", async ({ page }) => {
  await page.addInitScript(() => {
    window.__spoken = [];
    window.__utterances = [];
    window.__cancelled = 0;
    const fake = {
      speak(utterance) {
        window.__spoken.push(String(utterance && utterance.text || ""));
        window.__utterances.push(utterance);
      },
      cancel() {
        window.__cancelled += 1;
      },
    };
    Object.defineProperty(window, "speechSynthesis", {
      configurable: true,
      get() {
        return fake;
      },
    });
  });

  await page.goto("./?d=2026-06-16&tr=NIV", { waitUntil: "domcontentloaded" });
  await expect(page.locator("#passage-ref")).toHaveText("Matthew 1:1-17");
  await expect(page.locator("#btn-listen")).toHaveText("Listen");
  await page.locator("#btn-listen").click();
  await expect(page.locator("#action-status")).toHaveText("Reading aloud…");
  await expect(page.locator("#btn-listen")).toHaveText("Stop");
  await expect(page.locator("#btn-listen")).toHaveAttribute("aria-pressed", "true");
  const spoken = await page.evaluate(() => window.__spoken.at(-1));
  expect(spoken).toContain("Matthew 1:1-17");
  expect(spoken).toContain("NIV book 40 chapter 1 verse 1");

  await page.locator("#btn-listen").click();
  await expect(page.locator("#action-status")).toHaveText("Stopped reading.");
  await expect(page.locator("#btn-listen")).toHaveText("Listen");
  expect(await page.evaluate(() => window.__cancelled)).toBeGreaterThan(0);

  await page.keyboard.press("l");
  await expect(page.locator("#btn-listen")).toHaveText("Stop");
  await page.evaluate(() => window.__utterances.at(-1).onend());
  await expect(page.locator("#btn-listen")).toHaveText("Listen");
  await expect(page.locator("#btn-listen")).toHaveAttribute("aria-pressed", "false");

  await page.keyboard.press("l");
  await expect(page.locator("#btn-listen")).toHaveText("Stop");
  await page.evaluate(() => window.__utterances.at(-1).onerror());
  await expect(page.locator("#action-status")).toHaveText("Could not read passage.");
  await expect(page.locator("#btn-listen")).toHaveText("Listen");
  await expect(page.locator("#btn-listen")).toHaveAttribute("aria-pressed", "false");

  await page.locator("#btn-listen").click();
  await expect(page.locator("#btn-listen")).toHaveText("Stop");
  const spokenCount = await page.evaluate(() => window.__spoken.length);
  const cancelledBeforeTranslation = await page.evaluate(() => window.__cancelled);
  await page.locator("#translation").selectOption("ESV");
  await expect(page.locator("#action-status")).toHaveText("Stopped reading.");
  await expect(page.locator("#btn-listen")).toHaveText("Listen");
  await expect(page.locator("#btn-listen")).toHaveAttribute("aria-pressed", "false");
  expect(await page.evaluate(() => window.__cancelled)).toBeGreaterThan(cancelledBeforeTranslation);
  expect(await page.evaluate(() => window.__spoken.length)).toBe(spokenCount);
  await expect(page.locator("#passage-tr-label")).toHaveText("ESV");
});

test("resizes the passage and remembers the choice", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem(
      "christoday.v1",
      JSON.stringify({ translation: "NIV", days: {}, passageSize: "lg" }),
    );
  });

  await page.goto("./?d=2026-06-16&tr=NIV", { waitUntil: "domcontentloaded" });
  await expect(page.locator("html")).toHaveAttribute("data-passage-size", "lg");
  await expect(page.locator("#btn-type-larger")).toBeDisabled();
  await expect(page.locator("#btn-type-smaller")).toBeEnabled();

  await page.locator("#btn-type-smaller").click();
  await expect(page.locator("html")).toHaveAttribute("data-passage-size", "md");
  await expect(page.locator("#action-status")).toHaveText("Default passage text.");
  await page.keyboard.press("-");
  await expect(page.locator("html")).toHaveAttribute("data-passage-size", "sm");
  await expect(page.locator("#btn-type-smaller")).toBeDisabled();
  await expect(page.locator("#action-status")).toHaveText("Smaller passage text.");

  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("christoday.v1")));
  expect(saved.passageSize).toBe("sm");
});
