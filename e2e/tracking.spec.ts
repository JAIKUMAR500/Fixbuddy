import { expect, test } from "@playwright/test";
import { API, authHeaders, completeOnboarding, createJob, register, signIn } from "./helpers";

test.describe("live worker tracking", () => {
  test("customer sees live worker location after accept, then OTP starts and completes the job", async ({ request, page, browser }) => {
    const customer = await register(request, "customer");
    const worker = await register(request, "worker");
    await completeOnboarding(request, worker);
    const job = await createJob(request, customer);

    const accept = await request.post(`${API}/api/requests/${job.id}/accept`, {
      headers: authHeaders(worker),
      data: { lat: 11.02, lng: 76.96 },
    });
    expect(accept.ok(), await accept.text()).toBeTruthy();
    const accepted = await accept.json();
    expect(accepted.request.status).toBe("on_the_way");

    const ping = await request.patch(`${API}/api/requests/${job.id}/location`, {
      headers: authHeaders(worker),
      data: { lat: 11.019, lng: 76.958 },
    });
    expect(ping.ok(), await ping.text()).toBeTruthy();

    const stranger = await register(request, "worker");
    await completeOnboarding(request, stranger);
    const blocked = await request.get(`${API}/api/requests/${job.id}/tracking`, { headers: authHeaders(stranger) });
    expect(blocked.ok()).toBeFalsy();

    await signIn(page, customer);
    await page.goto("/job/active");
    await expect(page.getByTestId("live-track-map")).toBeVisible();
    await expect(page.getByText(/worker is on the way/i)).toBeVisible();
    await expect(page.getByTestId("map-tiles")).toBeVisible();
    await expect(page.getByTestId("marker-worker")).toBeVisible();
    await expect(page.getByTestId("marker-customer")).toBeVisible();
    await expect(page.getByTestId("track-route")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/live location/i)).toBeVisible();

    const arrive = await request.post(`${API}/api/requests/${job.id}/arrive`, {
      headers: authHeaders(worker),
      data: { lat: 11.0168, lng: 76.9558 },
    });
    expect(arrive.ok(), await arrive.text()).toBeTruthy();
    const customerView = await request.get(`${API}/api/requests/${job.id}`, { headers: authHeaders(customer) });
    const otp = (await customerView.json()).request.jobOtp as string;
    expect(otp).toMatch(/^\d{4}$/);

    await page.reload();
    await expect(page.getByText(otp)).toBeVisible();
    await expect(page.getByText("Your Fixbuddy worker has arrived.")).toBeVisible();

    const workerPage = await browser.newPage();
    await workerPage.context().grantPermissions(["geolocation"]);
    await workerPage.context().setGeolocation({ latitude: 11.0168, longitude: 76.9558 });
    await signIn(workerPage, worker);
    await workerPage.goto("/job/active");
    await expect(workerPage.getByRole("button", { name: /mark as arrived/i })).toHaveCount(0);
    await workerPage.getByPlaceholder(/4-digit otp/i).fill(otp);
    await workerPage.getByRole("button", { name: /verify otp/i }).click();
    await expect(workerPage.getByText(/work in progress/i)).toBeVisible({ timeout: 15_000 });
    await workerPage.getByRole("button", { name: /complete work/i }).click();

    await page.reload();
    await expect(page.getByRole("button", { name: /confirm completion/i })).toBeVisible();
    await page.getByRole("button", { name: /confirm completion/i }).click();

    const gpsAfter = await request.patch(`${API}/api/requests/${job.id}/location`, {
      headers: authHeaders(worker),
      data: { lat: 11.1, lng: 77.1 },
    });
    expect(gpsAfter.ok()).toBeFalsy();

    await workerPage.close();
  });
});
