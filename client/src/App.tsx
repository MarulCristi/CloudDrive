import './App.css'
import './i18n';
import { useState } from 'react';
import { BrowserRouter, Routes, Route, useNavigate } from 'react-router-dom';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import { CssBaseline, Button, AppBar, Toolbar, Typography, MenuItem, Select, useMediaQuery } from '@mui/material';
import { Brightness4, Brightness7, Logout } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import LoginComponent from './components/LoginComponent';
import ProtectedRoute from './components/Protected';
import RegisterComponent from './components/RegisterComponent';
import FileManager from './components/FileManager';
import DocumentEditor from './components/DocumentEditor';

function NavBar({ isDark, setIsDark }: { isDark: boolean; setIsDark: (v: boolean) => void }) {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const token = localStorage.getItem('token');
  const isLoggedIn = !!token;
  const isMobile = useMediaQuery('(max-width:600px)');

  const handleLogout = () => {
    localStorage.removeItem('token');
    navigate('/login');
  };

  return (
    <AppBar position="fixed">
      <Toolbar sx={{ display: 'flex', justifyContent: 'space-between' }}>
        <Typography
          variant="h6"
          sx={{ fontWeight: 'bold', letterSpacing: 1, cursor: 'pointer', '&:hover': { opacity: 0.8 } }}
          onClick={() => navigate('/')}
        >
          ☁️ {t('cloudDrive')}
        </Typography>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Select
            value={i18n.language}
            onChange={(e) => i18n.changeLanguage(e.target.value)}
            size="small"
            variant="outlined"
            sx={{ color: 'inherit', '.MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.3)' }, '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.6)' }, '.MuiSvgIcon-root': { color: 'inherit' }, minWidth: 70 }}
          >
            <MenuItem value="en">EN</MenuItem>
            <MenuItem value="fi">FI</MenuItem>
            <MenuItem value="ro">RO</MenuItem>
            <MenuItem value="ru">RU</MenuItem>
            <MenuItem value="pl">PL</MenuItem>
          </Select>
          <Button
            onClick={() => setIsDark(!isDark)}
            color="inherit"
            startIcon={isDark ? <Brightness7 /> : <Brightness4 />}
            size={isMobile ? 'small' : 'medium'}
          >
            {isMobile ? '' : (isDark ? t('light') : t('dark'))}
          </Button>
          {isLoggedIn && (
            <Button
              onClick={handleLogout}
              color="inherit"
              startIcon={<Logout />}
              size={isMobile ? 'small' : 'medium'}
            >
              {isMobile ? '' : t('logout')}
            </Button>
          )}
        </div>
      </Toolbar>
    </AppBar>
  );
}

function App() {
  const [isDark, setIsDark] = useState(true);

  const theme = createTheme({
    palette: {
      mode: isDark ? 'dark' : 'light',
      background: {
        default: isDark ? '#121212' : '#ffffff',
      }
    },
  });

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <BrowserRouter>
        <NavBar isDark={isDark} setIsDark={setIsDark} />
        <Routes>
          <Route path="/login" element={<LoginComponent />} />
          <Route path="/register" element={<RegisterComponent />} />
          <Route path="/share/:token" element={<DocumentEditor />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <FileManager />
              </ProtectedRoute>
            }
          />
          <Route
            path="/edit/:id"
            element={
              <ProtectedRoute>
                <DocumentEditor />
              </ProtectedRoute>
            }
          />
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  );
}

export default App