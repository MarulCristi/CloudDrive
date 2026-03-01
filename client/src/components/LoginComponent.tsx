import { useState } from 'react';
import { TextField, Button, Box, Alert, Typography, Link as MuiLink } from "@mui/material";
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

function LoginComponent() {  // Capitalize the name!
    const [emailOrUsername, setEmailOrUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const navigate = useNavigate(); // to navigate back to main page. Couldve also used link, but i like this more
    const { t } = useTranslation();

    const handleLogin = async () => {
        setError(''); // to clear errors

        const response = await fetch('/api/auth/login', {  // Use proxy path
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ 
                email: emailOrUsername, 
                username: emailOrUsername,
                password 
            })
        });

        const data = await response.json();

        if (response.ok) {
            localStorage.setItem('token', data.token)
            navigate('/')
        } else {
            setError(data.error)
        }
    };

    return (
    <Box
      sx={{
        maxWidth: 420,
        width: '90%',
        margin: '48px auto',
        p: 3,
        borderRadius: 2,
        bgcolor: (theme) => theme.palette.mode === 'light' ? '#e6e6e6' : '#3e3e42',
        boxShadow: 1
      }}
    >
        <Typography variant="h4" sx={{ color: '#279ce5', mb: 2, textAlign: 'center' }}>
            {t('login.title')}
        </Typography>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        <form
            onSubmit={(e) => {
                e.preventDefault();
                handleLogin();
            }}
        >
            <TextField
                label={t('login.emailOrUsername')}
                variant="outlined"
                fullWidth
                margin="normal"
                value={emailOrUsername}
                onChange={(e) => setEmailOrUsername(e.target.value)}
            />

            <TextField
                label={t('login.password')}
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
                {t('login.submit')}
            </Button>
        </form>

        <Typography variant="body2" sx={{ mt: 2, textAlign: 'center' }}>
            {t('login.noAccount')}{' '}
            <MuiLink
                component="button"
                variant="body2"
                onClick={() => navigate('/register')}
                sx={{ cursor: 'pointer' }}
            >
                {t('login.register')}
            </MuiLink>
        </Typography>
    </Box>
    )
}

export default LoginComponent;