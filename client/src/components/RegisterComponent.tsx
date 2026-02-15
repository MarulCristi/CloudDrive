import { useState } from 'react';
import { TextField, Button, Box, Alert, Typography } from "@mui/material";
import { useNavigate } from 'react-router-dom';

function RegisterComponent() {
    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const navigate = useNavigate();

    const handleRegister = async () => {
        setError('');

        const response = await fetch('/api/auth/register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                username,
                email,
                password,
                isAdmin: false, // set it to false. Can be manually changed in the database to avoid normal users from being "admins".
            })
        });

        const data = await response.json();

        if (response.ok) {
            navigate('/login'); // Navigate to login after successful registration
        } else {
            // Handle both error formats: data.errors (from validators) and data.error (from custom checks)
            if (data.errors && Array.isArray(data.errors)) {
                setError(data.errors.map((err: { msg: string }) => err.msg).join(', '));
            } else {
                setError(data.error || 'Registration failed');
            }
        }
    };

    return (
        <Box
            sx={{
                maxWidth: 420,
                margin: '48px auto',
                p: 3,
                borderRadius: 2,
                bgcolor: (theme) => theme.palette.mode === 'light' ? '#e6e6e6' : '#3e3e42',
                boxShadow: 1
            }}
        >
            <Typography variant="h4" sx={{ color: '#279ce5', mb: 2, textAlign: 'center' }}>
                Register
            </Typography>
            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

            <form
                onSubmit={(e) => {
                    e.preventDefault();
                    handleRegister();
                }}
            >
                <TextField
                    label="Username"
                    variant="outlined"
                    fullWidth
                    margin="normal"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                />

                <TextField
                    label="Email"
                    type="email"
                    variant="outlined"
                    fullWidth
                    margin="normal"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                />

                <TextField
                    label="Password"
                    type="password"
                    variant="outlined"
                    fullWidth
                    margin="normal"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                />

                <Button
                    type="submit"
                    variant="contained"
                    fullWidth
                    sx={{ mt: 2 }}
                >
                    Register
                </Button>
            </form>
        </Box>
    );
}

export default RegisterComponent;