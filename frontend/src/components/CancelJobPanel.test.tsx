import React from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import CancelJobPanel from "./CancelJobPanel";
import type { JobRequest } from "../api/client";
import { CANCELLABLE_JOB_STATUSES, PAID_JOB_STATUSES } from "../api/jobLock";

type PanelJob = Pick<JobRequest, "id" | "code" | "category" | "description" | "status">;

const job: PanelJob = {
  id: "job1",
  code: "REQ-0001",
  category: "Plumbing",
  description: "Kitchen tap leaking",
  status: "on_the_way",
};

const travelPolicy: JobRequest["cancelPolicy"] = {
  free: false,
  afterTravel: true,
  amount: 75,
  title: "Travel compensation may apply",
  text: "Cancelling now may add ₹75 travel compensation for the worker.",
};

const freePolicy: JobRequest["cancelPolicy"] = {
  free: true,
  afterTravel: false,
  amount: 0,
  title: "Free cancellation",
  text: "Cancel once while a worker is still being found. No travel fee.",
};

describe("CancelJobPanel visibility", () => {
  it("renders for every cancellable job status", () => {
    for (const status of CANCELLABLE_JOB_STATUSES) {
      const { unmount } = render(
        <CancelJobPanel worker={false} job={{ ...job, status }} onCancel={() => {}} />
      );
      expect(screen.getByRole("button", { name: /cancel job/i }), status).toBeInTheDocument();
      unmount();
    }
  });

  it("stays hidden once the job is paid or closed", () => {
    for (const status of [...PAID_JOB_STATUSES, "cancelled", "declined"]) {
      const { container, unmount } = render(
        <CancelJobPanel worker={false} job={{ ...job, status }} onCancel={() => {}} />
      );
      expect(container).toBeEmptyDOMElement();
      unmount();
    }
  });
});

describe("cancellation fee disclosure", () => {
  it("shows the travel compensation policy text before confirming", async () => {
    render(<CancelJobPanel worker={false} job={job} policy={travelPolicy} onCancel={() => {}} />);

    await userEvent.click(screen.getByRole("button", { name: /cancel job/i }));

    expect(screen.getByText(/₹75 travel compensation/i)).toBeInTheDocument();
    expect(screen.getByText(/one cancel closes this job for both sides/i)).toBeInTheDocument();
  });

  it("shows the free cancellation policy while a worker is still being found", async () => {
    render(
      <CancelJobPanel worker={false} job={{ ...job, status: "matching" }} policy={freePolicy} onCancel={() => {}} />
    );

    await userEvent.click(screen.getByRole("button", { name: /cancel job/i }));

    expect(screen.getByText(/no travel fee/i)).toBeInTheDocument();
  });
});

describe("cancellation confirmation", () => {
  it("requires a reason before the confirm button works", async () => {
    const onCancel = vi.fn();
    render(<CancelJobPanel worker={false} job={job} policy={travelPolicy} onCancel={onCancel} />);

    await userEvent.click(screen.getByRole("button", { name: /cancel job/i }));
    const confirm = screen.getByRole("button", { name: /confirm cancel/i });
    expect(confirm).toBeDisabled();

    await userEvent.click(screen.getByRole("combobox"));
    await userEvent.click(screen.getByRole("option", { name: "Worker delayed" }));

    expect(confirm).toBeEnabled();
    await userEvent.click(confirm);
    expect(onCancel).toHaveBeenCalledWith("Worker delayed");
  });

  it("offers worker reasons to a worker and customer reasons to a customer", async () => {
    const { unmount } = render(<CancelJobPanel worker job={job} onCancel={() => {}} />);
    await userEvent.click(screen.getByRole("button", { name: /cancel job/i }));
    await userEvent.click(screen.getByRole("combobox"));
    expect(screen.getByRole("option", { name: "Vehicle problem" })).toBeInTheDocument();
    unmount();

    render(<CancelJobPanel worker={false} job={job} onCancel={() => {}} />);
    await userEvent.click(screen.getByRole("button", { name: /cancel job/i }));
    await userEvent.click(screen.getByRole("combobox"));
    expect(screen.getByRole("option", { name: "Found another option" })).toBeInTheDocument();
  });
});
