import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
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
import AIAssistant from './pages/AIAssistant';
import OnboardingDemo from './pages/OnboardingDemo';
import Projects from './pages/Projects';

import Help from './pages/Help';

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();
  const [onboardingDone, setOnboardingDone] = useState(null);

  useEffect(() => {
    if (isLoadingAuth || isLoadingPublicSettings || authError) return;
    const check = async () => {
      try {
        const u = await base44.auth.me();
        const p = await base44.entities.UserPreferences.filter({ user_email: u.email });
        setOnboardingDone(p.length > 0 && p[0].onboarding_complete);
      } catch {
        setOnboardingDone(false);
      }
    };
    check();
  }, [isLoadingAuth, isLoadingPublicSettings, authError]);

  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
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
      <div className="fixed inset-0 flex items-center justify-center bg-[#0f1117]">
        <div className="w-8 h-8 border-4 border-stone-700 border-t-amber-500 rounded-full animate-spin"></div>
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
        <Route path="/ai" element={<AIAssistant />} />
        <Route path="/travel" element={<Travel />} />
        <Route path="/projects" element={<Projects />} />

        <Route path="/help" element={<Help />} />
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