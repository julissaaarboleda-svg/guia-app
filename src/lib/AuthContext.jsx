import { createContext, useContext, useEffect, useState } from "react";
import { netlifyIdentity } from "@/api/base44Client";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(undefined); // undefined = not yet known
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);

  useEffect(() => {
    const onInit = (u) => { setUser(u || null); setIsLoadingAuth(false); };
    const onLogin = (u) => setUser(u);
    const onLogout = () => setUser(null);

    netlifyIdentity.on("init", onInit);
    netlifyIdentity.on("login", onLogin);
    netlifyIdentity.on("logout", onLogout);

    // netlifyIdentity.init() already ran in base44Client.js on import — if "init"
    // already fired before this effect subscribed, currentUser() has the answer now.
    const existing = netlifyIdentity.currentUser();
    if (existing !== undefined) { setUser(existing); setIsLoadingAuth(false); }

    return () => {
      netlifyIdentity.off("init", onInit);
      netlifyIdentity.off("login", onLogin);
      netlifyIdentity.off("logout", onLogout);
    };
  }, []);

  const isAuthenticated = !!user;
  // NOTE: Base44 distinguished "auth_required" vs "user_not_registered" (an allowlist
  // concept). Netlify Identity has no built-in allowlist, so everything unauthenticated
  // is just "auth_required" here. If you want an invite-only allowlist later, that'd be
  // a small additional check against a stored list of approved emails.
  const authError = user === null ? { type: "auth_required" } : null;

  const value = {
    user,
    isAuthenticated,
    isLoadingAuth,
    isLoadingPublicSettings: false, // Base44-specific concept; nothing to load here
    authError,
    navigateToLogin: () => netlifyIdentity.open("login"),
    logout: () => netlifyIdentity.logout(),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}
