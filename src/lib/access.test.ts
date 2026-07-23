import { describe, it, expect, beforeAll } from "vitest";
import type { AccessStatus } from "@prisma/client";

type Access = typeof import("./access");
let access: Access;

beforeAll(async () => {
  process.env.AUTH_ALLOWED_DOMAIN = "bombaysweetshop.com,hungerinc.in";
  process.env.AUTH_ALLOWED_EMAILS = "founder@gmail.com";
  access = await import("./access");
});

const user = (email: string, status: AccessStatus) => ({ email, status });

describe("isBootstrapAllowed", () => {
  it("allows any company-domain email (case-insensitive)", () => {
    expect(access.isBootstrapAllowed("Ops@bombaysweetshop.com")).toBe(true);
    expect(access.isBootstrapAllowed("x@hungerinc.in")).toBe(true);
  });
  it("allows env-listed emails, rejects everyone else", () => {
    expect(access.isBootstrapAllowed("founder@gmail.com")).toBe(true);
    expect(access.isBootstrapAllowed("stranger@gmail.com")).toBe(false);
    expect(access.isBootstrapAllowed(null)).toBe(false);
  });
});

describe("isApproved", () => {
  it("company/env users are approved regardless of stored status", () => {
    expect(access.isApproved(user("ops@bombaysweetshop.com", "PENDING"))).toBe(true);
    expect(access.isApproved(user("founder@gmail.com", "PENDING"))).toBe(true);
  });
  it("external users need explicit APPROVED", () => {
    expect(access.isApproved(user("new@gmail.com", "PENDING"))).toBe(false);
    expect(access.isApproved(user("new@gmail.com", "APPROVED"))).toBe(true);
  });
  it("BLOCKED denies even a company-domain email", () => {
    expect(access.isApproved(user("ops@bombaysweetshop.com", "BLOCKED"))).toBe(false);
    expect(access.isApproved(user("new@gmail.com", "BLOCKED"))).toBe(false);
  });
});
