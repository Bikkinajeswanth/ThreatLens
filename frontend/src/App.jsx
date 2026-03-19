import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import ProtectedRoute from './routes/ProtectedRoute';
import Layout from './components/Layout';

import Login       from './pages/Login';
import Register    from './pages/Register';
import Dashboard   from './pages/Dashboard';
import NewScan     from './pages/NewScan';
import ScanHistory from './pages/ScanHistory';
import ScanResults from './pages/ScanResults';
import Reports     from './pages/Reports';
import Targets     from './pages/Targets';

const PublicRoute = ({ children }) => {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? <Navigate to="/" replace /> : children;
};

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login"    element={<PublicRoute><Login /></PublicRoute>} />
      <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />

      <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route index             element={<Dashboard />} />
        <Route path="scan"       element={<NewScan />} />
        <Route path="history"    element={<ScanHistory />} />
        <Route path="results/:id" element={<ScanResults />} />
        <Route path="reports"    element={<Reports />} />
        <Route path="targets"    element={<Targets />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <Router>
          {/* Body background is driven by CSS vars — no Tailwind bg class needed */}
          <div className="min-h-screen">
            <AppRoutes />
            <Toaster
              position="top-right"
              toastOptions={{
                duration: 4000,
                style: {
                  background: 'var(--bg-secondary)',
                  color:      'var(--text-primary)',
                  border:     '1px solid var(--border-color)',
                  boxShadow:  '0 4px 16px rgba(0,0,0,0.25)',
                },
                success: { iconTheme: { primary: 'var(--sev-low)',      secondary: 'var(--bg-secondary)' } },
                error:   { iconTheme: { primary: 'var(--sev-critical)', secondary: 'var(--bg-secondary)' } },
              }}
            />
          </div>
        </Router>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
