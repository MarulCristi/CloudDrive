import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import App from '../App';

// Reset state between tests
beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
    // Reset URL back to "/" so BrowserRouter starts fresh each test
    window.history.pushState({}, '', '/');
});

// Protected Route - what happens when you're NOT logged in

describe('Protected Route - blocks unauthenticated users', () => {
    it('shows "Access Denied" when visiting "/" without a token', () => {
        render(<App />);
        // The ProtectedRoute component should block access and show this heading
        expect(screen.getByRole('heading', { name: /access denied/i })).toBeInTheDocument();
    });

    it('shows a Login and Create Account button on the Access Denied page', () => {
        render(<App />);
        // These buttons let the user navigate to login or register
        expect(screen.getByRole('button', { name: /login/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /create account/i })).toBeInTheDocument();
    });

    it('navigates to login page when clicking "Login" on Access Denied', () => {
        render(<App />);
        // Click the Login button on the protected route's Access Denied screen
        fireEvent.click(screen.getByRole('button', { name: /^login$/i }));
        // Now we should see the Login form (with its heading)
        expect(screen.getByRole('heading', { name: /login/i })).toBeInTheDocument();
        // And the email input field unique to the Login form
        expect(screen.getByLabelText(/email or username/i)).toBeInTheDocument();
    });

    it('navigates to register page when clicking "Create Account" on Access Denied', () => {
        render(<App />);
        // The Access Denied page has both Login and Create Account buttons
        const createAccountBtn = screen.getByRole('button', { name: /create account/i });
        fireEvent.click(createAccountBtn);
        // Now the Register form should be visible
        expect(screen.getByRole('heading', { name: /register/i })).toBeInTheDocument();
        expect(screen.getByLabelText(/username/i)).toBeInTheDocument();
    });

    it('removes an expired/invalid token and shows Access Denied', () => {
        // Store a garbage token that jwt-decode will fail on
        localStorage.setItem('token', 'not-a-real-jwt');
        render(<App />);
        // ProtectedRoute calls isTokenExpired -> jwtDecode fails -> treats as expired
        // It removes the token and shows Access Denied
        expect(screen.getByRole('heading', { name: /access denied/i })).toBeInTheDocument();
        expect(localStorage.getItem('token')).toBeNull();
    });
});

// Logout - does clicking Logout actually clear the session?

describe('Logout functionality', () => {
    it('shows the Logout button only when a token exists', () => {
        // Without token -> no Logout button
        const { unmount } = render(<App />);
        expect(screen.queryByRole('button', { name: /logout/i })).not.toBeInTheDocument();
        unmount();

        // With token -> Logout button appears
        localStorage.setItem('token', 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1c2VyIn0.sig');
        render(<App />);
        expect(screen.getByRole('button', { name: /logout/i })).toBeInTheDocument();
    });

    it('clears the token from localStorage when Logout is clicked', () => {
        localStorage.setItem('token', 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1c2VyIn0.sig');
        render(<App />);

        fireEvent.click(screen.getByRole('button', { name: /logout/i }));

        // Token should be gone from localStorage
        expect(localStorage.getItem('token')).toBeNull();
    });

    it('redirects to login page after logging out', () => {
        localStorage.setItem('token', 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1c2VyIn0.sig');
        render(<App />);

        fireEvent.click(screen.getByRole('button', { name: /logout/i }));

        // After logout the navbar should navigate to /login
        // The Login form heading should now be visible
        expect(screen.getByRole('heading', { name: /login/i })).toBeInTheDocument();
    });
});

// Theme Toggle - does dark/light mode actually change?

describe('Theme Toggle', () => {
    it('starts in dark mode by default (button says "Light" to switch)', () => {
        render(<App />);
        expect(screen.getByRole('button', { name: /light/i })).toBeInTheDocument();
    });

    it('switches background color when toggling theme', () => {
        render(<App />);

        // Click to switch to light mode
        fireEvent.click(screen.getByRole('button', { name: /light/i }));
        expect(screen.getByRole('button', { name: /dark/i })).toBeInTheDocument();

        // Click back to dark mode
        fireEvent.click(screen.getByRole('button', { name: /dark/i }));
        expect(screen.getByRole('button', { name: /light/i })).toBeInTheDocument();
    });
});

// Login Form - does the form submit and handle errors?
describe('Login Form - submitting with wrong credentials', () => {
    it('shows an error message when the server returns an error', async () => {

        // Mock fetch to simulate a failed login response
        vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
            ok: false,
            json: async () => ({ error: 'Invalid email/username' }),
        } as Response);

        render(<App />);

        // Navigate to login page first
        fireEvent.click(screen.getByRole('button', { name: /^login$/i }));

        // Fill in the form
        fireEvent.change(screen.getByLabelText(/email or username/i), {
            target: { value: 'wronguser@test.com' },
        });
        fireEvent.change(screen.getByLabelText(/password/i), {
            target: { value: 'WrongPass#1' },
        });

        // Submit the form
        fireEvent.submit(screen.getByLabelText(/password/i).closest('form')!);

        // Wait for the error alert to appear
        await waitFor(() => {
            expect(screen.getByRole('alert')).toBeInTheDocument();
            expect(screen.getByText('Invalid email/username')).toBeInTheDocument();
        });
    });

    it('saves token to localStorage on successful login', async () => {
        const fakeToken = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1c2VyIn0.signed';

        // Mock fetch to simulate a successful login
        vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
            ok: true,
            json: async () => ({ token: fakeToken }),
        } as Response);

        render(<App />);

        // Navigate to login
        fireEvent.click(screen.getByRole('button', { name: /^login$/i }));

        // Fill form and submit
        fireEvent.change(screen.getByLabelText(/email or username/i), {
            target: { value: 'john@example.com' },
        });
        fireEvent.change(screen.getByLabelText(/password/i), {
            target: { value: 'Secure#1' },
        });
        fireEvent.submit(screen.getByLabelText(/password/i).closest('form')!);

        // After successful login the token should be stored
        await waitFor(() => {
            expect(localStorage.getItem('token')).toBe(fakeToken);
        });
    });
});

// Register Form - does it show errors and navigate on success?

describe('Register Form', () => {
    it('shows validation errors returned by the server', async () => {
        // Mock fetch to return validation errors (like the server does)
        vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
            ok: false,
            json: async () => ({
                errors: [
                    { msg: 'Username needs to be 5-25 characters.' },
                    { msg: 'Password needs to be at least 8 characters' },
                ],
            }),
        } as Response);

        // Navigate directly to /register via URL
        window.history.pushState({}, '', '/register');
        render(<App />);

        // Fill in invalid data and submit
        fireEvent.change(screen.getByLabelText(/username/i), { target: { value: 'Ab' } });
        fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'a@b.com' } });
        fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'x' } });
        fireEvent.submit(screen.getByLabelText(/password/i).closest('form')!);

        // Wait for the alert showing joined error messages
        await waitFor(() => {
            expect(screen.getByRole('alert')).toBeInTheDocument();
            expect(screen.getByText(/Username needs to be 5-25 characters/)).toBeInTheDocument();
        });
    });

    it('navigates to login page after successful registration', async () => {
        vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
            ok: true,
            json: async () => ({ message: 'User added successfully!' }),
        } as Response);

        // Navigate directly to /register via URL
        window.history.pushState({}, '', '/register');
        render(<App />);

        // Fill in valid data
        fireEvent.change(screen.getByLabelText(/username/i), { target: { value: 'JohnDoe' } });
        fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'john@example.com' } });
        fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'Secure#1' } });
        fireEvent.submit(screen.getByLabelText(/password/i).closest('form')!);

        // After successful registration, the app should navigate to /login
        await waitFor(() => {
            expect(screen.getByRole('heading', { name: /login/i })).toBeInTheDocument();
        });
    });
});

// Navbar - always visible elements

describe('Navbar', () => {
    it('always shows the Cloud Drive title', () => {
        render(<App />);
        expect(screen.getByText('☁️ Cloud Drive')).toBeInTheDocument();
    });

    it('always shows the theme toggle button even when logged out', () => {
        render(<App />);
        expect(screen.getByRole('button', { name: /light|dark/i })).toBeInTheDocument();
    });

    it('renders inside an AppBar (banner role)', () => {
        render(<App />);
        expect(screen.getByRole('banner')).toBeInTheDocument();
    });
});