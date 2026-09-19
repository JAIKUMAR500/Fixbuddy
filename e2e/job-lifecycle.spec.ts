import { expect, test } from "@playwright/test";
import { API, authHeaders, completeOnboarding, createJob, register, signIn } from "./helpers";

test.describe("job lifecycle", () => {
  test("customer and worker complete a simulated job including OTP, payment, and reviews", async ({ request, page, browser }) => {
    const customer = await register(request, "customer");
    const worker = await register(request, "worker");
    await completeOnboarding(request, worker);

    const job = await createJob(request, customer);
    expect(job.id).toBeTruthy();

    const listed = await request.get(`${API}/api/requests?inbox=true`, { headers: authHeaders(worker) });
    expect(listed.ok()).toBeTruthy();
    const inbox = await listed.json();
    expect(inbox.requests.some((row: { id: string }) => row.id === job.id)).toBeTruthy();

    const outsider = await register(request, "worker");
    await completeOnboarding(request, outsider);
    const peek = await request.get(`${API}/api/requests/${job.id}`, { headers: authHeaders(outsider) });
    const peekBody = await peek.json();
    if (peek.ok()) {
      expect(peekBody.request.address || "").not.toMatch(/flat|tower|gate/i);
    }

    const accept = await request.post(`${API}/api/requests/${job.id}/accept`, { headers: authHeaders(worker) });
    expect(accept.ok(), await accept.text()).toBeTruthy();

    await signIn(page, customer);
    await page.goto("/customer/create-request");
    await expect(page).toHaveURL(/\/job\/active$/);

    const enroute = await request.post(`${API}/api/requests/${job.id}/enroute`, {
      headers: authHeaders(worker),
      data: { lat: 11.02, lng: 76.96 },
    });
    expect(enroute.ok(), await enroute.text()).toBeTruthy();

    const arrive = await request.post(`${API}/api/requests/${job.id}/arrive`, {
      headers: authHeaders(worker),
      data: { lat: 11.0168, lng: 76.9558 },
    });
    expect(arrive.ok(), await arrive.text()).toBeTruthy();

    const customerView = await request.get(`${API}/api/requests/${job.id}`, { headers: authHeaders(customer) });
    const customerJob = await customerView.json();
    const otp = customerJob.request.jobOtp;
    expect(otp).toMatch(/^\d{4}$/);

    await page.goto("/job/active");
    await expect(page.getByText(otp)).toBeVisible();

    const workerPage = await browser.newPage();
    await signIn(workerPage, worker);
    await workerPage.goto("/job/active");
    await workerPage.getByPlaceholder(/4-digit otp/i).fill(otp);
    await workerPage.getByRole("button", { name: /^enter otp$/i }).click({ timeout: 15_000 });

    const start = await request.post(`${API}/api/requests/${job.id}/start`, { headers: authHeaders(worker) });
    expect(start.ok(), await start.text()).toBeTruthy();
    const complete = await request.post(`${API}/api/requests/${job.id}/complete`, { headers: authHeaders(worker) });
    expect(complete.ok(), await complete.text()).toBeTruthy();

    const gpsAfterComplete = await request.patch(`${API}/api/requests/${job.id}/location`, {
      headers: authHeaders(worker),
      data: { lat: 11.1, lng: 77.1 },
    });
    expect(gpsAfterComplete.ok()).toBeFalsy();

    const paid = await request.post(`${API}/api/requests/${job.id}/customer-complete`, { headers: authHeaders(customer) });
    expect(paid.ok(), await paid.text()).toBeTruthy();

    const customerReview = await request.post(`${API}/api/requests/${job.id}/review`, {
      headers: authHeaders(customer),
      data: { rating: 5, comment: "Fast and clean work" },
    });
    expect(customerReview.ok(), await customerReview.text()).toBeTruthy();

    const workerReview = await request.post(`${API}/api/requests/${job.id}/review`, {
      headers: authHeaders(worker),
      data: { rating: 5, comment: "Clear instructions" },
    });
    expect(workerReview.ok(), await workerReview.text()).toBeTruthy();

    await workerPage.close();
  });

  test("a customer can cancel an open request", async ({ request, page }) => {
    const customer = await register(request, "customer");
    const job = await createJob(request, customer);
    await signIn(page, customer);
    await page.goto(`/customer/requests/${job.id}`);
    await page.getByRole("button", { name: /cancel job/i }).first().click();
    await page.getByLabel(/why are you cancelling/i).click();
    await page.getByRole("option", { name: /changed plans/i }).click();
    await page.getByRole("button", { name: /confirm cancel/i }).click();
    await expect(page.getByText(/cancelled/i).first()).toBeVisible();
  });
});
