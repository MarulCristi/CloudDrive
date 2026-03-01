import { describe, it, expect, vi, beforeEach } from 'vitest';
import jwt from 'jsonwebtoken';
import { authenticateUser, authenticateAdmin } from './validateToken.js';
// We need a secret for signing test tokens
const TEST_SECRET = 'test-secret-key';
// Tell the middleware to use our test secret
beforeEach(() => {
    process.env.SECRET = TEST_SECRET;
});
//  Helper: creates a fake Express request with optional Authorization header
function mockRequest(authHeader) {
    return {
        header: (name) => {
            if (name === 'authorization')
                return authHeader;
            return undefined;
        },
    };
}
// Helper: creates a fake Express response that captures status + json
function mockResponse() {
    const res = {};
    res.statusCode = 200;
    res.body = null;
    res.status = (code) => {
        res.statusCode = code;
        return res;
    };
    res.json = (body) => {
        res.body = body;
        return res;
    };
    return res;
}
// authenticateUser
describe('authenticateUser middleware', () => {
    it('returns 401 when no Authorization header is sent', () => {
        const req = mockRequest(undefined); // no header at all
        const res = mockResponse();
        const next = vi.fn();
        authenticateUser(req, res, next);
        expect(res.statusCode).toBe(401);
        expect(res.body.message).toMatch(/no token/i);
        expect(next).not.toHaveBeenCalled(); // should NOT call next
    });
    it('returns 401 when the token is an invalid / garbage string', () => {
        const req = mockRequest('Bearer this.is.not.a.real.token');
        const res = mockResponse();
        const next = vi.fn();
        authenticateUser(req, res, next);
        expect(res.statusCode).toBe(401);
        expect(res.body.message).toMatch(/invalid token/i);
        expect(next).not.toHaveBeenCalled();
    });
    it('returns 401 when the token is expired', () => {
        // Create a token that expired 1 hour ago
        const expiredToken = jwt.sign({ _id: '123', username: 'testuser' }, TEST_SECRET, { expiresIn: '-1h' } // already expired
        );
        const req = mockRequest(`Bearer ${expiredToken}`);
        const res = mockResponse();
        const next = vi.fn();
        authenticateUser(req, res, next);
        expect(res.statusCode).toBe(401);
        expect(next).not.toHaveBeenCalled();
    });
    it('calls next() and attaches user data when the token is valid', () => {
        const payload = { _id: 'abc123', username: 'JohnDoe', isAdmin: false };
        const validToken = jwt.sign(payload, TEST_SECRET, { expiresIn: '1h' });
        const req = mockRequest(`Bearer ${validToken}`);
        const res = mockResponse();
        const next = vi.fn();
        authenticateUser(req, res, next);
        // next() should be called exactly once (request allowed through)
        expect(next).toHaveBeenCalledOnce();
        // The middleware should attach the decoded user to req.user
        expect(req.user).toBeDefined();
        expect(req.user?._id).toBe('abc123');
        expect(req.user?.username).toBe('JohnDoe');
    });
    it('returns 401 when Authorization header has no "Bearer " prefix', () => {
        const validToken = jwt.sign({ _id: '1' }, TEST_SECRET, { expiresIn: '1h' });
        // Send token without "Bearer " - split(" ")[1] will be undefined
        const req = mockRequest(validToken);
        const res = mockResponse();
        const next = vi.fn();
        authenticateUser(req, res, next);
        expect(res.statusCode).toBe(401);
        expect(next).not.toHaveBeenCalled();
    });
});
//# sourceMappingURL=validateToken.test.js.map