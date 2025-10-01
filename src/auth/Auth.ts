import type { User, AuthConfig } from "../types/index.ts";

export class Auth {
    private config: AuthConfig;
    private users = new Map<string, User>();

    constructor(config: AuthConfig) {
        this.config = config;
    }

    /**
     * Generate a JWT token (simplified version using Bun's crypto)
     */
    async generateToken(user: User): Promise<string> {
        const header = { alg: "HS256", typ: "JWT" };
        const payload = {
            sub: user.id,
            user,
            iat: Math.floor(Date.now() / 1000),
            exp: Math.floor(Date.now() / 1000) + this.getExpirationSeconds(),
        };

        const encodedHeader = this.base64UrlEncode(JSON.stringify(header));
        const encodedPayload = this.base64UrlEncode(JSON.stringify(payload));
        const signature = await this.sign(`${encodedHeader}.${encodedPayload}`);

        return `${encodedHeader}.${encodedPayload}.${signature}`;
    }

    /**
     * Verify a JWT token
     */
    async verifyToken(token: string): Promise<User | null> {
        try {
            const [encodedHeader, encodedPayload, signature] = token.split(".");
            if (!encodedHeader || !encodedPayload || !signature) return null;

            // Verify signature
            const expectedSignature = await this.sign(
                `${encodedHeader}.${encodedPayload}`,
            );
            if (signature !== expectedSignature) return null;

            // Decode payload
            const payload = JSON.parse(this.base64UrlDecode(encodedPayload));

            // Check expiration
            if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
                return null;
            }

            return payload.user;
        } catch {
            return null;
        }
    }

    /**
     * Extract token from Authorization header
     */
    extractTokenFromHeader(request: Request): string | null {
        const authHeader = request.headers.get("Authorization");
        if (!authHeader) return null;

        const [type, token] = authHeader.split(" ");
        if (type !== "Bearer" || !token) return null;

        return token;
    }

    /**
     * Authenticate request
     */
    async authenticate(request: Request): Promise<User | null> {
        const token = this.extractTokenFromHeader(request);
        if (!token) return null;

        return await this.verifyToken(token);
    }

    /**
     * Hash password using Bun's built-in password hashing
     */
    async hashPassword(password: string): Promise<string> {
        return await Bun.password.hash(password, {
            algorithm: "bcrypt",
            cost: 10,
        });
    }

    /**
     * Verify password
     */
    async verifyPassword(password: string, hash: string): Promise<boolean> {
        return await Bun.password.verify(password, hash);
    }

    /**
     * Sign data with secret
     */
    private async sign(data: string): Promise<string> {
        const encoder = new TextEncoder();
        const keyData = encoder.encode(this.config.secret);
        const dataBuffer = encoder.encode(data);

        const key = await crypto.subtle.importKey(
            "raw",
            keyData,
            { name: "HMAC", hash: "SHA-256" },
            false,
            ["sign"],
        );

        const signature = await crypto.subtle.sign("HMAC", key, dataBuffer);
        return this.base64UrlEncode(
            String.fromCharCode(...new Uint8Array(signature)),
        );
    }

    /**
     * Base64 URL encode
     */
    private base64UrlEncode(str: string): string {
        return btoa(str)
            .replace(/\+/g, "-")
            .replace(/\//g, "_")
            .replace(/=/g, "");
    }

    /**
     * Base64 URL decode
     */
    private base64UrlDecode(str: string): string {
        str = str.replace(/-/g, "+").replace(/_/g, "/");
        while (str.length % 4) {
            str += "=";
        }
        return atob(str);
    }

    /**
     * Get expiration time in seconds
     */
    private getExpirationSeconds(): number {
        const expiresIn = this.config.expiresIn ?? "1h";
        const match = expiresIn.match(/^(\d+)([smhd])$/);

        if (!match) return 3600; // Default 1 hour

        const value = parseInt(match[1] ?? "1");
        const unit = match[2];

        switch (unit) {
            case "s":
                return value;
            case "m":
                return value * 60;
            case "h":
                return value * 3600;
            case "d":
                return value * 86400;
            default:
                return 3600;
        }
    }
}
