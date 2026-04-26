// @vitest-environment node
import { test, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockCookieStore = {
  set: vi.fn(),
  get: vi.fn(),
  delete: vi.fn(),
};

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({
  cookies: vi.fn(() => mockCookieStore),
}));

const { createSession, getSession, deleteSession, verifySession } = await import("@/lib/auth");

beforeEach(() => {
  vi.clearAllMocks();
});

// createSession

test("createSession sets an httpOnly cookie named auth-token", async () => {
  await createSession("user-1", "user@example.com");

  expect(mockCookieStore.set).toHaveBeenCalledOnce();
  const [name, , options] = mockCookieStore.set.mock.calls[0];
  expect(name).toBe("auth-token");
  expect(options.httpOnly).toBe(true);
  expect(options.sameSite).toBe("lax");
  expect(options.path).toBe("/");
});

test("createSession cookie contains a JWT string", async () => {
  await createSession("user-1", "user@example.com");

  const token = mockCookieStore.set.mock.calls[0][1];
  expect(typeof token).toBe("string");
  expect(token.split(".")).toHaveLength(3);
});

test("createSession sets cookie expiry roughly 7 days in the future", async () => {
  const before = Date.now();
  await createSession("user-1", "user@example.com");
  const after = Date.now();

  const expires: Date = mockCookieStore.set.mock.calls[0][2].expires;
  const ms = expires.getTime();
  const sevenDays = 7 * 24 * 60 * 60 * 1000;
  expect(ms).toBeGreaterThanOrEqual(before + sevenDays - 1000);
  expect(ms).toBeLessThanOrEqual(after + sevenDays + 1000);
});

// getSession

test("getSession returns null when no cookie is present", async () => {
  mockCookieStore.get.mockReturnValue(undefined);

  const session = await getSession();
  expect(session).toBeNull();
});

test("getSession returns session payload from a valid token", async () => {
  await createSession("user-42", "hello@example.com");
  const token = mockCookieStore.set.mock.calls[0][1];
  mockCookieStore.get.mockReturnValue({ value: token });

  const session = await getSession();
  expect(session?.userId).toBe("user-42");
  expect(session?.email).toBe("hello@example.com");
});

test("getSession returns null for a malformed token", async () => {
  mockCookieStore.get.mockReturnValue({ value: "not.a.jwt" });

  const session = await getSession();
  expect(session).toBeNull();
});

test("getSession returns null for a token signed with wrong secret", async () => {
  // This token is signed with "wrong-secret"
  mockCookieStore.get.mockReturnValue({
    value:
      "eyJhbGciOiJIUzI1NiJ9.eyJ1c2VySWQiOiIxIn0.invalid-signature",
  });

  const session = await getSession();
  expect(session).toBeNull();
});

// deleteSession

test("deleteSession removes the auth-token cookie", async () => {
  await deleteSession();

  expect(mockCookieStore.delete).toHaveBeenCalledWith("auth-token");
});

// verifySession

function makeRequest(token?: string): NextRequest {
  const req = new NextRequest("http://localhost/");
  if (token) {
    req.cookies.set("auth-token", token);
  }
  return req;
}

test("verifySession returns null when request has no cookie", async () => {
  const session = await verifySession(makeRequest());
  expect(session).toBeNull();
});

test("verifySession returns session payload from a valid request cookie", async () => {
  await createSession("user-99", "req@example.com");
  const token = mockCookieStore.set.mock.calls[0][1];

  const session = await verifySession(makeRequest(token));
  expect(session?.userId).toBe("user-99");
  expect(session?.email).toBe("req@example.com");
});

test("verifySession returns null for a malformed request token", async () => {
  const session = await verifySession(makeRequest("bad.token.here"));
  expect(session).toBeNull();
});
