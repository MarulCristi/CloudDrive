import './App.css'
import { useState } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import { CssBaseline, Button, AppBar, Toolbar } from '@mui/material';
import { Brightness4, Brightness7 } from '@mui/icons-material';
import LoginComponent from './components/LoginComponent';
import ProtectedRoute from './components/Protected';
import RegisterComponent from './components/RegisterComponent';


function App() {

  const [isDark, setIsDark] = useState(true); // dark as default

  const theme = createTheme({
    palette: {
      mode: isDark ? 'dark' : 'light',
      background: {
        default: isDark ? '#121212' : '#ffffff',
      }
    },
  });

  return (
    <>
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <BrowserRouter>
        <AppBar position="fixed">
          <Toolbar sx={{ display: 'flex', justifyContent: 'flex-end' }}>
            { /*Brightness7 is darkness, 4 is light mode */}
            <Button 
              onClick={() => setIsDark(!isDark)} 
              color="inherit"
              startIcon={isDark ? <Brightness7 /> : <Brightness4 />}
            >
              {isDark ? 'Light' : 'Dark'}
            </Button>
          </Toolbar>
        </AppBar>
          <Routes>
            <Route path="/login" element={<LoginComponent />} />
            <Route path="/register" element={<RegisterComponent />} />
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <h1>Welcome to Cloud Drive</h1>
                </ProtectedRoute>
              }
            />
          </Routes>
      </BrowserRouter>
    </ThemeProvider>
    </>
  )
}

export default App
