import { expect, test } from "@playwright/test";

test.describe("error boundary", () => {
  test("a deliberate render crash is caught and is not a blank page", async ({ page }) => {
    // Query flag is ignored in production builds (see E2eCrashProbe).
    await page.goto("/login?e2eCrash=1");

    await expect(page.getByText("Something went wrong")).toBeVisible();
    await expect(page.getByRole("button", { name: /try again/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /back to home/i })).toBeVisible();
    await expect(page.locator("#root")).not.toBeEmpty();
    await expect(page.getByText("Your problem.")).toHaveCount(0);
  });
});
