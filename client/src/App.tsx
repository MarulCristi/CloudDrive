import './App.css'
import { useState } from 'react';
import { BrowserRouter, Routes, Route, useNavigate } from 'react-router-dom';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import { CssBaseline, Button, AppBar, Toolbar, Typography } from '@mui/material';
import { Brightness4, Brightness7, Logout } from '@mui/icons-material';
import LoginComponent from './components/LoginComponent';
import ProtectedRoute from './components/Protected';
import RegisterComponent from './components/RegisterComponent';
import FileManager from './components/FileManager';
import DocumentEditor from './components/DocumentEditor';

function NavBar({ isDark, setIsDark }: { isDark: boolean; setIsDark: (v: boolean) => void }) {
  const navigate = useNavigate();
  const token = localStorage.getItem('token');
  const isLoggedIn = !!token;

  const handleLogout = () => {
    localStorage.removeItem('token');
    navigate('/login');
  };

  return (
    <AppBar position="fixed">
      <Toolbar sx={{ display: 'flex', justifyContent: 'space-between' }}>
        <Typography variant="h6" sx={{ fontWeight: 'bold', letterSpacing: 1 }}>
          ☁️ Cloud Drive
        </Typography>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Button
            onClick={() => setIsDark(!isDark)}
            color="inherit"
            startIcon={isDark ? <Brightness7 /> : <Brightness4 />}
          >
            {isDark ? 'Light' : 'Dark'}
          </Button>
          {isLoggedIn && (
            <Button
              onClick={handleLogout}
              color="inherit"
              startIcon={<Logout />}
            >
              Logout
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