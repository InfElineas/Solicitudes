import { Toaster } from "@/components/ui/sonner"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-clients'
import { pagesConfig } from './pages.config'
import { BrowserRouter as Router, Route, Routes, Navigate, useLocation } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import Login from './pages/Login';
import TrackRequest from './pages/TrackRequest';
import TrackIncident from './pages/TrackIncident';
import { usePresence } from '@/hooks/usePresence';

const RequireRole = ({ allowed, children }) => {
  const { user } = useAuth();
  if (!allowed.includes(user?.role)) return <Navigate to="/" replace />;
  return children;
};

const { Pages, Layout, mainPage } = pagesConfig;
const mainPageKey = mainPage ?? Object.keys(Pages)[0];
const MainPage = mainPageKey ? Pages[mainPageKey] : <></>;

const LayoutWrapper = ({ children, currentPageName }) => Layout
  ? <Layout currentPageName={currentPageName}>{children}</Layout>
  : <>{children}</>;

const LoadingScreen = () => (
  <div className="fixed inset-0 flex items-center justify-center" style={{ background: 'hsl(222,47%,8%)' }}>
    <div className="w-8 h-8 border-4 border-white/10 border-t-white/60 rounded-full animate-spin" />
  </div>
);

const AuthenticatedApp = () => {
  const { isLoadingAuth, isAuthenticated, user } = useAuth();
  const location = useLocation();
  usePresence(user?.email);

  if (isLoadingAuth) {
    return <LoadingScreen />;
  }

  // No autenticado → ir a login
  if (!isAuthenticated) {
    return location.pathname === '/login'
      ? <Login />
      : <Navigate to="/login" replace />;
  }

  // Autenticado pero intenta ir a /login → ir al inicio
  if (location.pathname === '/login') {
    return <Navigate to="/" replace />;
  }

  // Admin siempre arranca en el dashboard
  if (location.pathname === '/' && user?.role === 'admin') {
    return <Navigate to="/Analysis" replace />;
  }

  // App principal
  return (
    <Routes>
      <Route path="/" element={
        <LayoutWrapper currentPageName={mainPageKey}>
          <MainPage />
        </LayoutWrapper>
      } />
      {Object.entries(Pages).map(([pageName, Page]) => {
        const adminOnly = ['ManageUsers', 'Departments', 'AutomationRules'];
        const adminAuditor = ['AuditLog', 'Trash'];
        let element = (
          <LayoutWrapper currentPageName={pageName}>
            <Page />
          </LayoutWrapper>
        );
        if (adminOnly.includes(pageName)) {
          element = <RequireRole allowed={['admin']}>{element}</RequireRole>;
        } else if (adminAuditor.includes(pageName)) {
          element = <RequireRole allowed={['admin', 'auditor']}>{element}</RequireRole>;
        }
        return <Route key={pageName} path={`/${pageName}`} element={element} />;
      })}
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};

function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <Routes>
            {/* Rutas públicas — sin autenticación */}
            <Route path="/track/:token" element={<TrackRequest />} />
            <Route path="/track-incident/:token" element={<TrackIncident />} />
            {/* Todo lo demás requiere auth */}
            <Route path="*" element={<AuthenticatedApp />} />
          </Routes>
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  );
}

export default App;
