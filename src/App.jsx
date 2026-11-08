import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { ent } from '@/lib/freshEntities';
import Layout from './components/Layout';
import Onboarding from './pages/Onboarding';
import Dashboard from './pages/Dashboard';
import Goals from './pages/Goals';
import Notes from './pages/Notes';
import Settings from './pages/Settings';
import Career from './pages/Career';
import SectionPlaceholder from './pages/SectionPlaceholder';
import Travel from './pages/Travel';
import Business from './pages/Business';
import Finance from './pages/Finance';
import OnboardingDemo from './pages/OnboardingDemo';
import Projects from './pages/Projects';
import AdminFeedback from './pages/AdminFeedback';
import Backup from './pages/Backup';
import Recap from './pages/Recap';


const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();
  const [onboardingDone, setOnboardingDone] = useState(null);

  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    if (isLoadingAuth || isLoadingPublicSettings || authError) return;
    let alive = true;
    const check = async () => {
      setOnboardingDone(null);
      try {
        const u = await base44.auth.me();
        const p = await ent.UserPreferences.filter({ user_email: u.email });
        if (alive) setOnboardingDone(p.length > 0 && !!p[0].onboarding_complete);
      } catch (err) {
        // A failed lookup (expired session, network, server hiccup) must NOT be
        // treated as "new user" — that dropped returning users onto the welcome
        // screen. Show a retry screen instead.
        console.error("Profile check failed:", err);
        if (alive) setOnboardingDone("error");
      }
    };
    check();
    return () => { alive = false; };
  }, [isLoadingAuth, isLoadingPublicSettings, authError, retryKey]);

  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-border border-t-[#A7773F] rounded-full animate-spin"></div>
      </div>
    );
  }

  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      navigateToLogin();
      return null;
    }
  }

  if (onboardingDone === null) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-4 border-border border-t-[#A7773F] rounded-full animate-spin"></div>
      </div>
    );
  }

  if (onboardingDone === "error") {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background px-6">
        <div className="w-full max-w-sm bg-card border border-border rounded-3xl shadow-editorial p-7 text-center">
          <h1 className="font-heading text-xl text-foreground mb-2">Couldn't load your account</h1>
          <p className="font-body text-[13px] text-muted-foreground mb-5">
            This is usually a dropped connection or an expired sign-in. Your data is safe.
          </p>
          <button onClick={() => setRetryKey((k) => k + 1)} className="w-full bg-[#A7773F] text-white rounded-full py-3 font-heading text-[15px] mb-2.5">
            Try again
          </button>
          <button onClick={() => { base44.auth.logout(); }} className="w-full border border-border text-foreground rounded-full py-3 font-body text-[13px]">
            Sign in again
          </button>
        </div>
      </div>
    );
  }

  if (!onboardingDone) {
    return (
      <Routes>
        <Route path="/onboarding" element={<Onboarding />} />
        <Route path="*" element={<Navigate to="/onboarding" replace />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/goals" element={<Goals />} />
        <Route path="/notes" element={<Notes />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/career" element={<Career />} />
        <Route path="/business" element={<Business />} />
        <Route path="/finance" element={<Finance />} />
        <Route path="/travel" element={<Travel />} />
        <Route path="/projects" element={<Projects />} />
        <Route path="/recap" element={<Recap />} />
        <Route path="/backup" element={<Backup />} />
        <Route path="/admin/feedback" element={<AdminFeedback />} />

        <Route path="/onboarding" element={<Navigate to="/" replace />} />
        <Route path="*" element={<PageNotFound />} />
      </Route>
      {/* Demo page without layout wrapper */}
      <Route path="/onboarding-demo" element={<OnboardingDemo />} />
    </Routes>
  );
};

function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App