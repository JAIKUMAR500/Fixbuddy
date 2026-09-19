import React from "react";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { JobProgress, jobPrimaryAction } from "./JobProgress";

describe("jobPrimaryAction", () => {
  it("follows the worker job state machine", () => {
    expect(jobPrimaryAction("matching")).toBe("accept");
    expect(jobPrimaryAction("accepted")).toBe("enroute");
    expect(jobPrimaryAction("on_the_way")).toBe("arrive");
    expect(jobPrimaryAction("arrived")).toBe("otp");
    expect(jobPrimaryAction("otp_verified")).toBe("start");
    expect(jobPrimaryAction("in_progress")).toBe("complete");
    expect(jobPrimaryAction("completed")).toBe("collect");
    expect(jobPrimaryAction("payment_collected")).toBeNull();
    expect(jobPrimaryAction("cancelled")).toBeNull();
  });
});

describe("JobProgress", () => {
  it("marks OTP verified as the active step", () => {
    render(<JobProgress status="otp_verified" />);
    expect(screen.getByText("OTP verified")).toBeInTheDocument();
  });
});
