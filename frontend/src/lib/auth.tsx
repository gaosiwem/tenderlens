"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { apiFetch, setAccessToken } from "./api";
import type { MeResponse } from "./types";

type AuthState = {
  isReady: boolean;
  isAuthed: boolean;
  me: MeResponse | null;
};

type AuthCtx = AuthState & {
  login: (
    email: string,
    password: string,
  ) => Promise<{ ok: true } | { ok: false; code: string; message: string }>;
  loginWithGoogle: (
    credential: string,
  ) => Promise<{ ok: true } | { ok: false; code: string; message: string }>;
  register: (
    email: string,
    password: string,
    name?: string,
  ) => Promise<{ ok: true } | { ok: false; code: string; message: string }>;
  logout: () => Promise<void>;
  refreshMe: () => Promise<void>;
};

const Ctx = React.createContext<AuthCtx | null>(null);

function getAuthUiMessage(error: { code: string; message: string }) {
  if (error.code === "INTERNAL_ERROR" || error.code === "NOT_READY") {
    return "Unable to sign in right now. Please try again shortly.";
  }
  return error.message;
}

function getActiveOrgId(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem("tl_active_org_id");
}

function setActiveOrgId(orgId: string) {
  window.localStorage.setItem("tl_active_org_id", orgId);
}

const PROFILE_KEY = "tl_user_profile";

export function isSystemAdmin(profile?: MeResponse | null) {
  return Boolean(
    profile?.orgs.some(
      (orgMembership) =>
        orgMembership.org.name === "Admin Organization" &&
        orgMembership.role === "ADMIN",
    ),
  );
}

function getCachedProfile(): MeResponse | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(PROFILE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function setCachedProfile(profile: MeResponse | null) {
  if (typeof window === "undefined") return;
  if (profile) {
    window.localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  } else {
    window.localStorage.removeItem(PROFILE_KEY);
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [state, setState] = React.useState<AuthState>(() => {
    const cached = getCachedProfile();
    return {
      isReady: false,
      isAuthed: !!cached,
      me: cached,
    };
  });

  const refreshMe = React.useCallback(async () => {
    const me = await apiFetch<MeResponse>("/api/v1/me", { method: "GET" });
    if (!me.ok) {
      setCachedProfile(null);
      setState({ isReady: true, isAuthed: false, me: null });
      return;
    }

    const current = getActiveOrgId();
    const myOrgIds = me.data.orgs.map((o) => o.org.id);

    if (current && !myOrgIds.includes(current)) {
      // Stale or invalid orgId, clear it or pick new default
      if (myOrgIds.length > 0) {
        setActiveOrgId(myOrgIds[0]);
      } else {
        if (typeof window !== "undefined") {
          window.localStorage.removeItem("tl_active_org_id");
        }
      }
    } else if (!current && myOrgIds.length > 0) {
      setActiveOrgId(myOrgIds[0]);
    }

    setCachedProfile(me.data);
    setState({ isReady: true, isAuthed: true, me: me.data });
  }, []);

  React.useEffect(() => {
    refreshMe();
  }, [refreshMe]);

  const login: AuthCtx["login"] = async (email, password) => {
    const res = await apiFetch<{ accessToken: string }>("/api/v1/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok)
      return {
        ok: false,
        code: res.error.code,
        message: getAuthUiMessage(res.error),
      };

    setAccessToken(res.data.accessToken);
    await refreshMe();
    return { ok: true };
  };

  const register: AuthCtx["register"] = async (email, password, name) => {
    const res = await apiFetch<{
      id: string;
      email: string;
      name: string | null;
      devVerificationToken?: string | null;
    }>("/api/v1/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, password, name }),
    });
    if (!res.ok)
      return {
        ok: false,
        code: res.error.code,
        message: getAuthUiMessage(res.error),
      };
    return { ok: true };
  };

  const loginWithGoogle: AuthCtx["loginWithGoogle"] = async (credential) => {
    const res = await apiFetch<{ accessToken: string }>("/api/v1/auth/google", {
      method: "POST",
      body: JSON.stringify({ credential }),
    });
    if (!res.ok)
      return {
        ok: false,
        code: res.error.code,
        message: getAuthUiMessage(res.error),
      };

    setAccessToken(res.data.accessToken);
    await refreshMe();
    return { ok: true };
  };

  const logout: AuthCtx["logout"] = async () => {
    await apiFetch("/api/v1/auth/logout", { method: "POST" });
    setAccessToken(null);
    if (typeof window !== "undefined") {
      window.localStorage.removeItem("tl_active_org_id");
      window.localStorage.removeItem(PROFILE_KEY);
    }
    setState({ isReady: true, isAuthed: false, me: null });
    router.push("/auth/login");
  };

  const value: AuthCtx = {
    ...state,
    login,
    loginWithGoogle,
    register,
    logout,
    refreshMe,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const v = React.useContext(Ctx);
  if (!v) throw new Error("useAuth must be used within AuthProvider");
  return v;
}
