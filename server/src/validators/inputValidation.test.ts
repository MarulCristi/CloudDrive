import { describe, it, expect } from 'vitest';
import { registerValidation, loginValidation, handleValidation } from './inputValidation.js';
import type { Request, Response, NextFunction } from 'express';

// Helper: runs express-validator chain against a mock request
async function runValidation(body: object, validators: any[]) {
    const req = { body } as Request;
    for (const validator of validators) {
        await validator.run(req);
    }
    return req;
}

// Helper: checks if handleValidation calls next() or returns 400
function checkHandleValidation(req: Request): { passed: boolean; errors?: any[] } {
    let passed = false;
    let captured: any[] = [];

    const res = {
        status: (code: number) => ({
            json: (body: any) => { captured = body.errors; }
        })
    } as unknown as Response;

    const next: NextFunction = () => { passed = true; };

    handleValidation(req, res, next);
    return { passed, errors: captured };
}

//    Register Validation                                                     

describe('registerValidation - username', () => {
    it('passes with a valid username (5-25 chars)', async () => {
        const req = await runValidation(
            { username: 'JohnDoe', email: 'john@example.com', password: 'Secure#1' },
            registerValidation
        );
        const { passed } = checkHandleValidation(req);
        expect(passed).toBe(true);
    });

    it('fails when username is too short (< 5 chars)', async () => {
        const req = await runValidation(
            { username: 'Jo', email: 'john@example.com', password: 'Secure#1' },
            registerValidation
        );
        const { passed, errors } = checkHandleValidation(req);
        expect(passed).toBe(false);
        expect(errors?.some((e: any) => e.msg.includes('5-25'))).toBe(true);
    });

    it('fails when username is too long (> 25 chars)', async () => {
        const req = await runValidation(
            { username: 'A'.repeat(26), email: 'john@example.com', password: 'Secure#1' },
            registerValidation
        );
        const { passed } = checkHandleValidation(req);
        expect(passed).toBe(false);
    });
});

describe('registerValidation - email', () => {
    it('passes with a valid email', async () => {
        const req = await runValidation(
            { username: 'JohnDoe', email: 'john@example.com', password: 'Secure#1' },
            registerValidation
        );
        const { passed } = checkHandleValidation(req);
        expect(passed).toBe(true);
    });

    it('fails with an invalid email', async () => {
        const req = await runValidation(
            { username: 'JohnDoe', email: 'not-an-email', password: 'Secure#1' },
            registerValidation
        );
        const { passed, errors } = checkHandleValidation(req);
        expect(passed).toBe(false);
        expect(errors?.some((e: any) => e.msg.includes('Email'))).toBe(true);
    });
});

describe('registerValidation - password', () => {
    it('passes with a strong password', async () => {
        const req = await runValidation(
            { username: 'JohnDoe', email: 'john@example.com', password: 'Secure#1' },
            registerValidation
        );
        const { passed } = checkHandleValidation(req);
        expect(passed).toBe(true);
    });

    it('fails when password is too short (< 8 chars)', async () => {
        const req = await runValidation(
            { username: 'JohnDoe', email: 'john@example.com', password: 'Ab#1' },
            registerValidation
        );
        const { passed } = checkHandleValidation(req);
        expect(passed).toBe(false);
    });

    it('fails when password has no uppercase letter', async () => {
        const req = await runValidation(
            { username: 'JohnDoe', email: 'john@example.com', password: 'secure#1' },
            registerValidation
        );
        const { passed, errors } = checkHandleValidation(req);
        expect(passed).toBe(false);
        expect(errors?.some((e: any) => e.msg.includes('uppercase'))).toBe(true);
    });

    it('fails when password has no lowercase letter', async () => {
        const req = await runValidation(
            { username: 'JohnDoe', email: 'john@example.com', password: 'SECURE#1' },
            registerValidation
        );
        const { passed, errors } = checkHandleValidation(req);
        expect(passed).toBe(false);
        expect(errors?.some((e: any) => e.msg.includes('lower case'))).toBe(true);
    });

    it('fails when password has no digit', async () => {
        const req = await runValidation(
            { username: 'JohnDoe', email: 'john@example.com', password: 'Secure##' },
            registerValidation
        );
        const { passed, errors } = checkHandleValidation(req);
        expect(passed).toBe(false);
        expect(errors?.some((e: any) => e.msg.includes('digit'))).toBe(true);
    });

    it('fails when password has no special character (#!&%?)', async () => {
        const req = await runValidation(
            { username: 'JohnDoe', email: 'john@example.com', password: 'Secure12' },
            registerValidation
        );
        const { passed, errors } = checkHandleValidation(req);
        expect(passed).toBe(false);
        expect(errors?.some((e: any) => e.msg.includes('special character'))).toBe(true);
    });

    it('fails when password has 3 repeated sequential characters', async () => {
        const req = await runValidation(
            { username: 'JohnDoe', email: 'john@example.com', password: 'Seeecure#1' },
            registerValidation
        );
        const { passed, errors } = checkHandleValidation(req);
        expect(passed).toBe(false);
        expect(errors?.some((e: any) => e.msg.includes('same character 3 times'))).toBe(true);
    });
});

// Login Validation 

describe('loginValidation', () => {
    it('passes with email and password', async () => {
        const req = await runValidation(
            { email: 'john@example.com', password: 'anypassword' },
            loginValidation
        );
        const { passed } = checkHandleValidation(req);
        expect(passed).toBe(true);
    });

    it('fails when password is missing', async () => {
        const req = await runValidation(
            { email: 'john@example.com', password: '' },
            loginValidation
        );
        const { passed } = checkHandleValidation(req);
        expect(passed).toBe(false);
    });
});

// Edge-case / boundary tests                                              

describe('registerValidation - boundary lengths', () => {
    it('passes when username is exactly 5 characters (minimum)', async () => {
        const req = await runValidation(
            { username: 'Abcde', email: 'a@b.com', password: 'Secure#1' },
            registerValidation
        );
        const { passed } = checkHandleValidation(req);
        expect(passed).toBe(true);
    });

    it('passes when username is exactly 25 characters (maximum)', async () => {
        const req = await runValidation(
            { username: 'A'.repeat(25), email: 'a@b.com', password: 'Secure#1' },
            registerValidation
        );
        const { passed } = checkHandleValidation(req);
        expect(passed).toBe(true);
    });

    it('fails when username is exactly 4 characters (one below minimum)', async () => {
        const req = await runValidation(
            { username: 'Abcd', email: 'a@b.com', password: 'Secure#1' },
            registerValidation
        );
        const { passed } = checkHandleValidation(req);
        expect(passed).toBe(false);
    });

    it('passes when password is exactly 8 characters (minimum)', async () => {
        const req = await runValidation(
            { username: 'JohnDoe', email: 'a@b.com', password: 'Secur#1a' },
            registerValidation
        );
        const { passed } = checkHandleValidation(req);
        expect(passed).toBe(true);
    });
});

describe('registerValidation - empty / missing fields', () => {
    it('fails when username is empty', async () => {
        const req = await runValidation(
            { username: '', email: 'a@b.com', password: 'Secure#1' },
            registerValidation
        );
        const { passed } = checkHandleValidation(req);
        expect(passed).toBe(false);
    });

    it('fails when email is empty', async () => {
        const req = await runValidation(
            { username: 'JohnDoe', email: '', password: 'Secure#1' },
            registerValidation
        );
        const { passed } = checkHandleValidation(req);
        expect(passed).toBe(false);
    });

    it('fails when password is empty', async () => {
        const req = await runValidation(
            { username: 'JohnDoe', email: 'a@b.com', password: '' },
            registerValidation
        );
        const { passed } = checkHandleValidation(req);
        expect(passed).toBe(false);
    });
});

describe('registerValidation - multiple errors at once', () => {
    it('returns multiple errors when all fields are invalid', async () => {
        const req = await runValidation(
            { username: 'Ab', email: 'bad', password: 'x' },
            registerValidation
        );
        const { passed, errors } = checkHandleValidation(req);
        expect(passed).toBe(false);
        // Should have errors for username, email, AND password
        expect(errors!.length).toBeGreaterThanOrEqual(3);
    });
});

describe('registerValidation - password with 2 repeated chars (allowed)', () => {
    it('passes when password has only 2 identical sequential characters', async () => {
        const req = await runValidation(
            { username: 'JohnDoe', email: 'a@b.com', password: 'Seecure#1' },
            registerValidation
        );
        const { passed } = checkHandleValidation(req);
        expect(passed).toBe(true);
    });
});