import { expect, test } from "@playwright/test";

const runtimeErrors = new WeakMap();

test.beforeEach(async ({ page }) => {
  const errors = [];
  runtimeErrors.set(page, errors);
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") {
      const location = message.location();
      const optionalSupportUnavailable = message.text() === "Failed to load resource: net::ERR_FAILED"
        && location.url.startsWith("https://alphaeusng.github.io/js/kofi-support.js");
      if (optionalSupportUnavailable) return;
      errors.push(`console: ${message.text()}${location.url ? ` (${location.url})` : ""}`);
    }
  });

  await page.route(/^https:\/\//, async (route) => {
    const request = route.request();
    if (new URL(request.url()).hostname === "bolls.life") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ error: "offline" }),
      });
      return;
    }
    const contentType = request.resourceType() === "stylesheet"
      ? "text/css"
      : request.resourceType() === "document"
        ? "text/html"
        : "application/javascript";
    await route.fulfill({ status: 200, contentType, body: "" });
  });
});

test.afterEach(async ({ page }) => {
  await page.waitForTimeout(100);
  expect(runtimeErrors.get(page), "unexpected browser runtime errors").toEqual([]);
});

test("preserves foreign caches and reloads the reading shell offline", async ({ context, page }) => {
  await page.goto("manifest.webmanifest");
  await page.evaluate(async () => {
    const foreign = await caches.open("other-project-offline-v1");
    await foreign.put("./foreign-sentinel", new Response("keep"));
    await foreign.put(
      "./js/version.js",
      new Response(
        'globalThis.SITE_VERSION = { id: "foreign-cache", label: "Wrong project" };',
        { headers: { "Content-Type": "application/javascript" } }
      )
    );
    await caches.open("christoday-obsolete-test");
  });

  await page.goto("./", { waitUntil: "domcontentloaded" });
  await expect(page.locator("#site-version")).not.toHaveText("—");
  const expectedVersion = await page.locator("#site-version").textContent();
  await page.evaluate(() => navigator.serviceWorker.ready);
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);

  const cacheNames = await page.evaluate(() => caches.keys());
  expect(cacheNames).toContain("other-project-offline-v1");
  expect(cacheNames).not.toContain("christoday-obsolete-test");
  expect(cacheNames.filter((name) => name.startsWith("christoday-"))).toHaveLength(1);

  const rootFetchOk = await page.evaluate(async () => {
    const response = await fetch(new URL("/", location.origin));
    return response.ok;
  });
  expect(rootFetchOk).toBe(true);
  await page.waitForTimeout(200);
  const rootEnteredChristoDayCache = await page.evaluate(async () => {
    const cacheName = (await caches.keys()).find((name) => name.startsWith("christoday-"));
    const cache = await caches.open(cacheName);
    return !!(await cache.match(new URL("/", location.origin)));
  });
  expect(
    rootEnteredChristoDayCache,
    "same-origin resources outside the worker scope must not enter its cache"
  ).toBe(false);

  const workerResponses = new Set();
  page.on("response", (response) => {
    if (response.fromServiceWorker()) workerResponses.add(new URL(response.url()).pathname);
  });

  await context.setOffline(true);
  const navigation = await page.reload({ waitUntil: "domcontentloaded" });
  expect(navigation?.fromServiceWorker()).toBe(true);
  await expect(page.locator("#site-version")).toHaveText(expectedVersion);
  await expect(page.locator("#fatal")).toBeHidden();

  const planOffline = await page.evaluate(async () => {
    const response = await fetch("data/segments.json");
    const plan = window.ChristoDayApp?.getPlan?.();
    return {
      ok: response.ok,
      hasPlan: !!plan,
      startDate: plan?.meta?.startDate || null,
    };
  });
  expect(planOffline.ok, "default plan fetch must succeed from the worker while offline").toBe(true);
  expect(planOffline.hasPlan, "validated plan must remain available offline").toBe(true);
  expect(planOffline.startDate).toBe("2026-06-15");

  const datePicker = page.locator("#date-pick");
  await datePicker.fill("2026-06-16");
  await datePicker.dispatchEvent("change");
  await expect(page.locator("#passage-ref")).toHaveText("Matthew 1:1-17");
  await expect(page.locator("#passage-body .fallback-ref")).toContainText("Matthew 1:1-17");
  await expect(page.locator("#passage-body")).toContainText("schedule still works fully offline");

  for (const path of [
    "/ChristoDay/",
    "/ChristoDay/css/style.css",
    "/ChristoDay/js/app.js",
    "/ChristoDay/data/segments.json",
  ]) {
    expect(workerResponses, `${path} must be served by the installed worker`).toContain(path);
  }
});
