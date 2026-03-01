import { useNavigate } from 'react-router-dom';
import { Box, Button } from '@mui/material';
import { jwtDecode } from 'jwt-decode'; // npm install jwtDecode to do isTokenExpired
import { useTranslation } from 'react-i18next';

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
  const { t } = useTranslation();

  if (!token || isTokenExpired(token)) { // simply check if user has token. If he does, then he's logged in.
    localStorage.removeItem('token');
    return (
    <>
        <h1>{t('protected.accessDenied')}</h1>
        <p>{t('protected.mustLogin')}</p>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button 
            variant="contained" 
            onClick={() => navigate('/login')}
          >
            {t('protected.login')}
          </Button>
          <Button 
            variant="outlined" 
            onClick={() => navigate('/register')}
          >
            {t('protected.createAccount')}
          </Button>
        </Box>
    </>
    );
  }

  return <>{children}</>;
}

export default Protected;