import { useNavigate } from 'react-router-dom';
import { Box, Button } from '@mui/material';

interface ProtectedRouteProps {
  children: React.ReactNode; // children = everything inside protected.
}

function Protected({ children }: ProtectedRouteProps) { // wrapper component that can be accessed only after login/register
  const token = localStorage.getItem('token');
  const navigate = useNavigate();

  if (!token) { // simply check if user has token. If he does, then he's logged in.
    return (
    <>
        <h1>Access Denied</h1>
        <p>You must log in or create an account to access this page.</p>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button 
            variant="contained" 
            onClick={() => navigate('/login')}
          >
            Login
          </Button>
          <Button 
            variant="outlined" 
            onClick={() => navigate('/register')}
          >
            Create Account
          </Button>
        </Box>
    </>
    );
  }

  return <>{children}</>;
}

export default Protected;