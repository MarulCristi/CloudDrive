import { useNavigate } from 'react-router-dom';
import { Box, Button } from '@mui/material';
import { jwtDecode } from 'jwt-decode'; // npm install jwtDecode to do isTokenExpired

interface ProtectedRouteProps {
  children: React.ReactNode; // children = everything inside protected.
}

function isTokenExpired(token: string): boolean { // currently the token expires, but the local storage remains the same. We should somehow check if the token is expired
  try {
    const decoded: any = jwtDecode(token);
    const currentTime = Date.now() / 1000; // Convert to seconds
    return decoded.exp < currentTime;
  } catch (error) {
    // If decoding fails, treat as expired
    return true;
  }
}

function Protected({ children }: ProtectedRouteProps) { // wrapper component that can be accessed only after login/register
  const token = localStorage.getItem('token');
  const navigate = useNavigate();

  if (!token || isTokenExpired(token)) { // simply check if user has token. If he does, then he's logged in.
    localStorage.removeItem('token');
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