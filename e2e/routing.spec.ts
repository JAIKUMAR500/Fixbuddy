import { expect, test } from "@playwright/test";
import { completeOnboarding, register, signIn } from "./helpers";

test.describe("public routing", () => {
  test("landing page is reachable at the site root", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/$/);
    await expect(page.locator("#root")).not.toBeEmpty();
  });

  test("public deep links render without a session", async ({ page }) => {
    for (const path of ["/login", "/business", "/admin-login"]) {
      await page.goto(path);
      await expect(page).toHaveURL(new RegExp(`${path}$`));
      await expect(page.locator("#root")).not.toBeEmpty();
    }
  });

  test("an unknown path falls back instead of showing a blank screen", async ({ page }) => {
    await page.goto("/this-route-does-not-exist");
    await expect(page.locator("#root")).not.toBeEmpty();
  });
});

test.describe("protected routing", () => {
  test("an anonymous visitor is sent to the login screen", async ({ page }) => {
    await page.goto("/customer/home");
    await expect(page).toHaveURL(/\/login$/);
  });

  test("every private deep link redirects when unauthenticated", async ({ page }) => {
    for (const path of ["/worker/passport", "/business/dashboard", "/job/active", "/wallet", "/settings"]) {
      await page.goto(path);
      await expect(page, `${path} should require a session`).toHaveURL(/\/login$/);
    }
  });
});

test.describe("authenticated routing", () => {
  test("a customer keeps the deep-linked route across a refresh", async ({ page, request }) => {
    const customer = await register(request, "customer");
    await signIn(page, customer);

    await page.goto("/customer/requests");
    await expect(page).toHaveURL(/\/customer\/requests$/);
    await expect(page.getByRole("heading", { name: /my requests/i })).toBeVisible();

    // Requirement: refresh must keep the current route.
    await page.reload();
    await expect(page).toHaveURL(/\/customer\/requests$/);
    await expect(page.getByRole("heading", { name: /my requests/i })).toBeVisible();
  });

  test("the site root resolves to the role home", async ({ page, request }) => {
    const customer = await register(request, "customer");
    await signIn(page, customer);

    await page.goto("/");
    await expect(page).toHaveURL(/\/customer\/home$/);
  });

  test("Back and Forward move between real URLs", async ({ page, request }) => {
    const customer = await register(request, "customer");
    await signIn(page, customer);

    await page.goto("/customer/home");
    await expect(page).toHaveURL(/\/customer\/home$/);

    await page.goto("/customer/requests");
    await expect(page).toHaveURL(/\/customer\/requests$/);

    await page.goBack();
    await expect(page).toHaveURL(/\/customer\/home$/);

    await page.goForward();
    await expect(page).toHaveURL(/\/customer\/requests$/);
  });

  test("a customer cannot open worker-only routes", async ({ page, request }) => {
    const customer = await register(request, "customer");
    await signIn(page, customer);

    await page.goto("/worker/passport");
    // The role guard bounces the customer back to their own home.
    await expect(page).toHaveURL(/\/customer\/home$/);
  });

  test("a worker cannot open customer-only routes", async ({ page, request }) => {
    const worker = await register(request, "worker");
    await completeOnboarding(request, worker);
    await signIn(page, worker);

    await page.goto("/customer/create-request");
    await expect(page).not.toHaveURL(/\/customer\/create-request$/);
  });

  test("an un-onboarded worker is held on onboarding", async ({ page, request }) => {
    const worker = await register(request, "worker");
    await signIn(page, worker);

    await page.goto("/worker/target");
    await expect(page).toHaveURL(/\/business\/onboarding$/);
  });
});
