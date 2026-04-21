import { createSessionToken, verifySessionToken } from "@/lib/session";

describe("session helpers", () => {
  const originalSecret = process.env.APP_SESSION_SECRET;

  beforeEach(() => {
    process.env.APP_SESSION_SECRET = "test-session-secret";
  });

  afterEach(() => {
    process.env.APP_SESSION_SECRET = originalSecret;
  });

  it("creates a token that can be verified", () => {
    expect(verifySessionToken(createSessionToken())).toBe(true);
  });

  it("rejects tampered tokens", () => {
    const [expiresAt] = createSessionToken().split(".");
    expect(verifySessionToken(`${expiresAt}.broken`)).toBe(false);
  });
});
