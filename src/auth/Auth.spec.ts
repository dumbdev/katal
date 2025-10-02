import { expect, describe, it, beforeEach } from "bun:test";
import { Auth } from "./Auth";
import type { User } from "../types";

describe("Auth", () => {
    let auth: Auth;
    const testUser: User = {
        id: "123",
        email: "test@example.com",
        name: "Test User"
    };

    beforeEach(() => {
        auth = new Auth({
            secret: "test-secret-key-12345",
            expiresIn: "1h"
        });
    });

    it("should generate and verify valid tokens", async () => {
        const token = await auth.generateToken(testUser);
        expect(token).toBeDefined();
        expect(typeof token).toBe("string");
        expect(token.split(".")).toHaveLength(3);

        const verified = await auth.verifyToken(token);
        expect(verified).toBeDefined();
        expect(verified?.id).toBe(testUser.id);
        expect(verified?.email).toBe(testUser.email);
        expect(verified?.name).toBe(testUser.name);
    });

    it("should reject invalid tokens", async () => {
        const invalidToken = "invalid.token.here";
        const verified = await auth.verifyToken(invalidToken);
        expect(verified).toBeNull();
    });

    it("should reject expired tokens", async () => {
        const now = Math.floor(Date.now() / 1000);
        const originalDateNow = Date.now;

        try {
            // Mock Date.now to return a controlled value
            Date.now = () => now * 1000;

            const shortAuth = new Auth({
                secret: "test-secret-key-12345",
                expiresIn: "1s"
            });

            const token = await shortAuth.generateToken(testUser);

            // Move time forward by 2 seconds
            Date.now = () => (now + 2) * 1000;

            const verified = await shortAuth.verifyToken(token);
            expect(verified).toBeNull();
        } finally {
            // Restore original Date.now
            Date.now = originalDateNow;
        }
    });

    it("should handle different expiration formats", async () => {
        const testCases = [
            { expiresIn: "30s", expected: 30 },
            { expiresIn: "5m", expected: 300 },
            { expiresIn: "2h", expected: 7200 },
            { expiresIn: "1d", expected: 86400 },
            { expiresIn: "invalid", expected: 3600 }, // default 1h
        ];

        for (const { expiresIn, expected } of testCases) {
            const testAuth = new Auth({ secret: "test", expiresIn });
            const result = Reflect.get(testAuth, 'getExpirationSeconds').call(testAuth);
            expect(result).toBe(expected);
        }
    });

    it("should extract token from Authorization header", async () => {
        const token = await auth.generateToken(testUser);
        const headers = new Headers();
        headers.set("Authorization", `Bearer ${token}`);
        const request = new Request("http://example.com", { headers });

        const extracted = auth.extractTokenFromHeader(request);
        expect(extracted).toBe(token);
    });

    it("should handle missing or invalid Authorization headers", () => {
        const testCases = [
            { authHeader: undefined },
            { authHeader: "Invalid" },
            { authHeader: "Token abc123" },
            { authHeader: "Bearer " },
        ];

        for (const { authHeader } of testCases) {
            const headers = new Headers();
            if (authHeader) headers.set("Authorization", authHeader);
            const request = new Request("http://example.com", { headers });
            const extracted = auth.extractTokenFromHeader(request);
            expect(extracted).toBeNull();
        }
    });

    it("should hash and verify passwords", async () => {
        const password = "mySecurePassword123";
        const hash = await auth.hashPassword(password);

        expect(hash).toBeDefined();
        expect(hash).not.toBe(password);

        const isValid = await auth.verifyPassword(password, hash);
        expect(isValid).toBe(true);

        const isInvalid = await auth.verifyPassword("wrongPassword", hash);
        expect(isInvalid).toBe(false);
    });

    it("should authenticate valid requests", async () => {
        const token = await auth.generateToken(testUser);
        const headers = new Headers();
        headers.set("Authorization", `Bearer ${token}`);
        const request = new Request("http://example.com", { headers });

        const user = await auth.authenticate(request);
        expect(user).toBeDefined();
        expect(user?.id).toBe(testUser.id);
        expect(user?.email).toBe(testUser.email);
    });

    it("should reject invalid authentication requests", async () => {
        const testCases = [
            {
                desc: "no token",
                authHeader: undefined
            },
            {
                desc: "invalid token format",
                authHeader: "Bearer invalid.token.here"
            },
            {
                desc: "wrong authorization type",
                authHeader: "Basic dGVzdDp0ZXN0"
            }
        ];

        for (const { authHeader } of testCases) {
            const headers = new Headers();
            if (authHeader) headers.set("Authorization", authHeader);
            const request = new Request("http://example.com", { headers });
            const user = await auth.authenticate(request);
            expect(user).toBeNull();
        }
    });

    it("should handle base64url encoding/decoding", async () => {
        const testString = "Test+String/With+Special=Characters";
        const encoded = Reflect.get(auth, 'base64UrlEncode').call(auth, testString);

        expect(encoded).not.toContain("+");
        expect(encoded).not.toContain("/");
        expect(encoded).not.toContain("=");

        const decoded = Reflect.get(auth, 'base64UrlDecode').call(auth, encoded);
        expect(decoded).toBe(testString);
    });

    it("should generate unique tokens for different users", async () => {
        const user1 = { ...testUser };
        const user2 = { ...testUser, id: "456", email: "other@example.com" };

        const token1 = await auth.generateToken(user1);
        const token2 = await auth.generateToken(user2);

        expect(token1).not.toBe(token2);

        const verified1 = await auth.verifyToken(token1);
        const verified2 = await auth.verifyToken(token2);

        expect(verified1?.id).toBe(user1.id);
        expect(verified2?.id).toBe(user2.id);
    });
});
