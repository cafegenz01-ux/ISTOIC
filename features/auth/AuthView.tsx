import React, { useState, useEffect, useRef } from "react";
import {
  ArrowRight,
  Loader2,
  Fingerprint,
  Lock,
  ShieldAlert,
  ScanFace,
  Chrome,
  KeyRound,
  Mail,
  HelpCircle,
  Terminal,
} from "lucide-react";

import {
  verifySystemPin,
  verifyMasterPin,
  isSystemPinConfigured,
  setSystemPin,
} from "../../utils/crypto";

import { BiometricService } from "../../services/biometricService";
import useLocalStorage from "../../hooks/useLocalStorage";
import { IstokIdentityService, IStokUserIdentity } from "../istok/services/istokIdentity";
import { LoginManual, RegisterManual, ForgotAccount, ForgotPin } from "./ManualAuth";

import { auth, db, firebaseConfigError, ensureAuthPersistence } from "../../services/firebaseConfig";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { authStyles } from "./authStyles";

interface AuthViewProps {
  onAuthSuccess: () => void;
}

type AuthStage =
  | "CHECKING"
  | "WELCOME"
  | "CREATE_ID"
  | "SETUP_PIN"
  | "LOCKED"
  | "BIOMETRIC_SCAN"
  | "LOGIN_MANUAL"
  | "REGISTER_MANUAL"
  | "FORGOT_PIN"
  | "FORGOT_ACCOUNT";

const MAX_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 5 * 60 * 1000;

const DEV_BYPASS_ENABLED = import.meta.env.VITE_ENABLE_DEV_BYPASS === "true";
const FIRESTORE_TIMEOUT_MS = 15000;

const withTimeout = async <T,>(promise: Promise<T>, timeoutMs = FIRESTORE_TIMEOUT_MS): Promise<T> =>
  new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Request timeout. Coba lagi.")), timeoutMs);
    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });

export const AuthView: React.FC<AuthViewProps> = ({ onAuthSuccess }) => {
  const [identity, setIdentity] = useLocalStorage<IStokUserIdentity | null>("istok_user_identity", null);
  const [bioEnabled, setBioEnabled] = useLocalStorage<boolean>("bio_auth_enabled", false);

  const [pendingGoogleUser, setPendingGoogleUser] = useState<IStokUserIdentity | null>(null);

  const [failedAttempts, setFailedAttempts] = useLocalStorage<number>("auth_failed_count", 0);
  const [lockoutUntil, setLockoutUntil] = useLocalStorage<number>("auth_lockout_until", 0);

  const [stage, setStage] = useState<AuthStage>("CHECKING");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shake, setShake] = useState(false);
  const [bioStatus, setBioStatus] = useState("SCANNING...");

  const [codename, setCodename] = useState("");
  const [pinInput, setPinInput] = useState("");

  const [isHardLocked, setIsHardLocked] = useState(false);
  const [countdown, setCountdown] = useState(0);

  // Success transition state
  const [isTransitioning, setIsTransitioning] = useState(false);

  // Prevent multiple simultaneous auth attempts
  const [isAuthAttemptInProgress, setIsAuthAttemptInProgress] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);

  const triggerShake = () => {
    setShake(true);
    setTimeout(() => setShake(false), 500);
  };

  const handleAuthSuccess = async (identity: IStokUserIdentity) => {
    setIsTransitioning(true);
    
    // Brief delay for visual feedback
    setTimeout(() => {
      setIdentity(identity);
      const nextStage = isSystemPinConfigured() ? "LOCKED" : "SETUP_PIN";
      setStage(nextStage);
      setIsTransitioning(false);
      
      // Final transition to dashboard after stage change
      setTimeout(() => {
        onAuthSuccess();
      }, 200);
    }, 200);
  };

  const setNiceError = (msg: string) => {
    setError(msg);
    triggerShake();
  };

  useEffect(() => {
    const root = document.documentElement;
    const updateViewport = () => {
      const viewport = window.visualViewport;
      const height = viewport?.height ?? window.innerHeight;
      root.style.setProperty("--auth-vh", `${height}px`);

      if (!viewport) {
        root.style.setProperty("--keyboard-offset", "0px");
        return;
      }

      const offset = Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop);
      root.style.setProperty("--keyboard-offset", `${offset}px`);
    };

    updateViewport();
    window.visualViewport?.addEventListener("resize", updateViewport);
    window.visualViewport?.addEventListener("scroll", updateViewport);
    window.addEventListener("resize", updateViewport);

    return () => {
      window.visualViewport?.removeEventListener("resize", updateViewport);
      window.visualViewport?.removeEventListener("scroll", updateViewport);
      window.removeEventListener("resize", updateViewport);
      root.style.removeProperty("--auth-vh");
      root.style.setProperty("--keyboard-offset", "0px");
    };
  }, []);

  useEffect(() => {
    const checkLockout = () => {
      const now = Date.now();
      if (lockoutUntil > now) {
        setIsHardLocked(true);
        setCountdown(Math.ceil((lockoutUntil - now) / 1000));
      } else {
        if (isHardLocked) {
          setIsHardLocked(false);
          setFailedAttempts(0);
          setLockoutUntil(0);
          setCountdown(0);
        }
      }
    };

    checkLockout();
    const interval = setInterval(checkLockout, 1000);
    return () => clearInterval(interval);
  }, [lockoutUntil, isHardLocked, setFailedAttempts, setLockoutUntil]);

  useEffect(() => {
    if (stage === "LOCKED" && !isHardLocked && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [stage, isHardLocked]);

  const handleBiometricScan = async () => {
    if (isHardLocked) return;

    setBioStatus("SCANNING FACE ID...");
    try {
      const success = await BiometricService.authenticate();
      if (success) {
        setBioStatus("AUTHORIZED");
        setFailedAttempts(0);
        setTimeout(onAuthSuccess, 500);
      } else {
        setBioStatus("FAILED");
        setTimeout(() => setStage("LOCKED"), 800);
      }
    } catch {
      setBioStatus("ERROR");
      setTimeout(() => setStage("LOCKED"), 800);
    }
  };

  useEffect(() => {
    let unsub: (() => void) | undefined;
    let initTimeoutId: ReturnType<typeof setTimeout> | undefined;
    let isInitializing = false;

    const initFlow = async () => {
      // Prevent concurrent initialization
      if (isInitializing) return;
      isInitializing = true;

      setError(null);

      if (firebaseConfigError) {
        setStage("WELCOME");
        setNiceError(firebaseConfigError);
        isInitializing = false;
        return;
      }

      // Ensure persistence before any listeners (important for iOS PWA)
      try {
        await ensureAuthPersistence("local");
      } catch (e) {
        console.warn("Auth persistence setup failed, continuing with session scope.", e);
      }

      // Check if user has identity but no PIN configured (new user)
      if (identity && identity.istokId) {
        // Always check PIN first - new users should setup PIN
        if (!isSystemPinConfigured()) {
          setStage("SETUP_PIN");
          isInitializing = false;
          return;
        }
        // Only go to LOCKED if PIN is already configured
        if (bioEnabled && !isHardLocked) {
          setStage("BIOMETRIC_SCAN");
          handleBiometricScan();
        } else {
          setStage("LOCKED");
        }
        isInitializing = false;
        return;
      }

      // Handle redirect flow (PWA iOS) - only check once per session
      const redirectPending = sessionStorage.getItem("istok_login_redirect") === "pending";
      const redirectProcessed = sessionStorage.getItem("istok_redirect_processed") === "true";
      const redirectProcessing = sessionStorage.getItem("istok_redirect_processing") === "true";
      const redirectHandled = sessionStorage.getItem("istok_redirect_handled") === "true";
      
      // If redirect was handled at index.tsx level, clear the flag and let auth state handle it
      if (redirectHandled) {
        sessionStorage.removeItem("istok_redirect_handled");
        sessionStorage.removeItem("istok_login_redirect");
        sessionStorage.removeItem("istok_redirect_processed");
        sessionStorage.removeItem("istok_redirect_processing");
        // Continue to auth state check below
      }
      
      // Prevent infinite loop: if redirect is being processed, wait a bit then clear and continue
      if (redirectProcessing && !redirectHandled) {
        // Wait a short time for processing to complete
        await new Promise(resolve => setTimeout(resolve, 500));
        const stillProcessing = sessionStorage.getItem("istok_redirect_processing") === "true";
        if (stillProcessing) {
          // Processing took too long, clear all flags and continue
          console.warn("[AUTH] Redirect processing timeout, clearing flags");
          sessionStorage.removeItem("istok_login_redirect");
          sessionStorage.removeItem("istok_redirect_processed");
          sessionStorage.removeItem("istok_redirect_processing");
        }
      }
      
      if (redirectPending && !redirectProcessed && !isAuthAttemptInProgress) {
        // Mark as processing to prevent multiple calls
        sessionStorage.setItem("istok_redirect_processed", "true");
        sessionStorage.setItem("istok_redirect_processing", "true");
        
        try {
          const redirectIdentity = await IstokIdentityService.finalizeRedirectIfAny();

          if (redirectIdentity) {
            // Clear all flags on success
            sessionStorage.removeItem("istok_login_redirect");
            sessionStorage.removeItem("istok_redirect_processed");
            sessionStorage.removeItem("istok_redirect_processing");
            
            // Set flag to indicate redirect was successfully processed
            // This prevents onAuthStateChanged from processing the same user again
            sessionStorage.setItem("istok_redirect_success", "true");
            
            // Persist identity immediately to ensure it's saved
            // finalizeRedirectIfAny already persists, but we ensure it here too
            setIdentity(redirectIdentity);
            
            if (redirectIdentity.istokId) {
              // User has existing profile
              // Always check PIN first - new users should setup PIN
              if (!isSystemPinConfigured()) {
                setStage("SETUP_PIN");
              } else {
                // Only go to LOCKED if PIN is already configured
                if (bioEnabled && !isHardLocked) {
                  setStage("BIOMETRIC_SCAN");
                  handleBiometricScan();
                } else {
                  setStage("LOCKED");
                }
              }
              isInitializing = false;
              return;
            }

            // New user, needs to create identity
            setPendingGoogleUser(redirectIdentity);
            setStage("CREATE_ID");
            isInitializing = false;
            return;
          } else {
            // No identity found, clear all flags and continue to normal flow
            console.log("[AUTH] Redirect completed but no identity found, clearing flags");
            sessionStorage.removeItem("istok_login_redirect");
            sessionStorage.removeItem("istok_redirect_processed");
            sessionStorage.removeItem("istok_redirect_processing");
            // Continue to normal auth flow below
          }
        } catch (error) {
          // Error during redirect finalization, clear flags and continue
          console.error("[AUTH] Error finalizing redirect:", error);
          sessionStorage.removeItem("istok_login_redirect");
          sessionStorage.removeItem("istok_redirect_processed");
          sessionStorage.removeItem("istok_redirect_processing");
          // Continue to normal auth flow below
        }
      } else if (!redirectPending && redirectProcessed) {
        // Clean up stale processing flags if redirect is no longer pending
        sessionStorage.removeItem("istok_redirect_processed");
        sessionStorage.removeItem("istok_redirect_processing");
      }

      if (auth && db) {
        unsub = onAuthStateChanged(auth, async (user) => {
          if (!user) {
            // Clear redirect flags when user signs out
            sessionStorage.removeItem("istok_login_redirect");
            sessionStorage.removeItem("istok_redirect_processed");
            sessionStorage.removeItem("istok_redirect_processing");
            sessionStorage.removeItem("istok_redirect_success");
            setStage("WELCOME");
            isInitializing = false;
            return;
          }

          // Check if redirect was successfully processed - if so, skip this auth state change
          // This prevents duplicate processing when onAuthStateChanged fires after redirect
          const redirectSuccess = sessionStorage.getItem("istok_redirect_success") === "true";
          if (redirectSuccess) {
            // Redirect already processed the user, clear the flag and skip
            console.log("[AUTH] Redirect already processed user, skipping onAuthStateChanged");
            sessionStorage.removeItem("istok_redirect_success");
            // Check if identity is already set from redirect
            if (identity && identity.uid === user.uid) {
              // Identity already set, don't process again
              isInitializing = false;
              return;
            }
            // Identity not set yet, continue to fetch it
          }
          
          // Check if redirect is still pending or processing
          const redirectPending = sessionStorage.getItem("istok_login_redirect") === "pending";
          const redirectProcessing = sessionStorage.getItem("istok_redirect_processing") === "true";
          
          // If redirect is still pending or processing, wait for it to complete
          if (redirectPending || redirectProcessing) {
            // Let the redirect handler above process it first
            // But set a timeout to prevent infinite waiting
            setTimeout(() => {
              const stillPending = sessionStorage.getItem("istok_login_redirect") === "pending";
              const stillProcessing = sessionStorage.getItem("istok_redirect_processing") === "true";
              if (stillPending || stillProcessing) {
                console.warn("[AUTH] Redirect handler timeout, forcing auth state check");
                sessionStorage.removeItem("istok_login_redirect");
                sessionStorage.removeItem("istok_redirect_processed");
                sessionStorage.removeItem("istok_redirect_processing");
                sessionStorage.removeItem("istok_redirect_success");
                // Trigger re-initialization
                initFlow();
              }
            }, 3000);
            isInitializing = false;
            return;
          }

          try {
            const snap = await withTimeout(getDoc(doc(db, "users", user.uid)));
            if (snap.exists()) {
              const data = snap.data() as IStokUserIdentity;
              setIdentity(data);

              // Always check PIN first - new users should setup PIN
              if (!isSystemPinConfigured()) {
                setStage("SETUP_PIN");
              } else {
                // Only go to LOCKED if PIN is already configured
                if (bioEnabled && !isHardLocked) {
                  setStage("BIOMETRIC_SCAN");
                  handleBiometricScan();
                } else {
                  setStage("LOCKED");
                }
              }
            } else {
              const tmp: IStokUserIdentity = {
                uid: user.uid,
                email: user.email || "",
                displayName: user.displayName || (user.email ? user.email.split("@")[0] : "USER"),
                photoURL: user.photoURL || "",
                istokId: "",
                codename: "",
              };
              setPendingGoogleUser(tmp);
              setStage("CREATE_ID");
            }
          } catch (e) {
            console.error("Silent Restore Failed", e);
            setStage("WELCOME");
          }
          isInitializing = false;
        });
      } else {
        setStage("WELCOME");
        isInitializing = false;
      }
    };

    initTimeoutId = setTimeout(initFlow, 100);
    
    // Safety timeout: if stuck in CHECKING for too long, force to WELCOME
    const safetyTimeout = setTimeout(() => {
      if (stage === "CHECKING") {
        console.warn("[AUTH] Safety timeout: stuck in CHECKING, forcing to WELCOME");
        // Clear any stale redirect flags
        sessionStorage.removeItem("istok_login_redirect");
        sessionStorage.removeItem("istok_redirect_processed");
        sessionStorage.removeItem("istok_redirect_processing");
        sessionStorage.removeItem("istok_redirect_success");
        setStage("WELCOME");
      }
    }, 10000); // 10 seconds timeout
    
    return () => {
      if (unsub) unsub();
      if (initTimeoutId) clearTimeout(initTimeoutId);
      clearTimeout(safetyTimeout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [identity?.istokId, bioEnabled, isHardLocked]);

  const handleGoogleLogin = async () => {
    // Prevent multiple simultaneous attempts
    if (loading || isAuthAttemptInProgress) return;

    setIsAuthAttemptInProgress(true);
    // Clear any stale flags before starting new login
    sessionStorage.removeItem("istok_redirect_processed");
    sessionStorage.removeItem("istok_redirect_processing");
    sessionStorage.removeItem("istok_redirect_success");
    sessionStorage.setItem("istok_login_redirect", "pending");
    setLoading(true);
    setError(null);

    try {
      const res = await IstokIdentityService.loginWithGoogle();

      if (res.status === "REDIRECT_STARTED") {
        // For redirect flow, don't reset loading/attempt flags yet
        // They will be cleared when redirect completes
        // The page will reload after redirect, so state will reset
        return;
      }

      // Clear redirect flag for non-redirect flows
      sessionStorage.removeItem("istok_login_redirect");
      sessionStorage.removeItem("istok_redirect_processed");
      sessionStorage.removeItem("istok_redirect_processing");
      sessionStorage.removeItem("istok_redirect_success");

      if (res.status === "SIGNED_IN") {
        const userProfile = res.identity;

        if (userProfile?.istokId) {
          handleAuthSuccess(userProfile);
          return;
        }

        setPendingGoogleUser(userProfile);
        setStage("CREATE_ID");
        return;
      }

      if (res.status === "CANCELLED") {
        setNiceError(res.message || "Login cancelled.");
        return;
      }

      if (res.status === "ERROR") {
        setNiceError(res.message || "Login Failed");
        return;
      }

      setNiceError("Login Failed");
    } catch (err: any) {
      setNiceError(err?.message || "Login Failed");
      // Always clear flags on error
      sessionStorage.removeItem("istok_login_redirect");
      sessionStorage.removeItem("istok_redirect_processed");
      sessionStorage.removeItem("istok_redirect_processing");
      sessionStorage.removeItem("istok_redirect_success");
    } finally {
      // Only reset loading/attempt flags if not redirecting
      const isRedirecting = sessionStorage.getItem("istok_login_redirect") === "pending";
      if (!isRedirecting) {
        setLoading(false);
        setIsAuthAttemptInProgress(false);
      }
    }
  };

  const handleCreateIdentity = async () => {
    setError(null);

    if (codename.trim().length < 3) {
      setNiceError("MINIMUM 3 CHARS");
      return;
    }

    const baseUser = pendingGoogleUser;
    if (!baseUser?.uid) {
      setNiceError("SESSION EXPIRED. PLEASE LOGIN AGAIN.");
      setStage("WELCOME");
      return;
    }

    const cleanCodename = codename.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
    const finalId = IstokIdentityService.formatId(cleanCodename);

    const newIdentity: IStokUserIdentity = {
      ...baseUser,
      codename: cleanCodename,
      istokId: finalId,
    };

    setLoading(true);
    try {
      await IstokIdentityService.createProfile(newIdentity);
      setIdentity(newIdentity);
      setPendingGoogleUser(null);
      setStage("SETUP_PIN");
    } catch (err: any) {
      setNiceError(err?.message || "Failed to create profile");
    } finally {
      setLoading(false);
    }
  };

  const handleSetupPin = async () => {
    setError(null);

    if (pinInput.length < 4) {
      setNiceError("PIN MIN 4 DIGITS");
      return;
    }

    await setSystemPin(pinInput);

    try {
      const available = await BiometricService.isAvailable();
      if (available) {
        const ok = confirm("Aktifkan Face ID / Fingerprint untuk akses cepat?");
        if (ok) {
          const res = await BiometricService.register(identity?.codename || "User");
          if (res) setBioEnabled(true);
        }
      }
    } catch (e) {
      console.error(e);
    }

    onAuthSuccess();
  };

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isHardLocked) return;

    setLoading(true);
    setError(null);

    await new Promise((r) => setTimeout(r, 600));

    if (DEV_BYPASS_ENABLED) {
      const isMaster = await verifyMasterPin(pinInput);
      if (isMaster) {
        const devIdentity: IStokUserIdentity = {
          uid: "DEV-ROOT-ACCESS",
          istokId: "ISTOIC-DEV",
          codename: "DEVELOPER",
          email: "dev@system.local",
          displayName: "SYSTEM ADMIN",
          photoURL: "https://ui-avatars.com/api/?name=Dev&background=10b981&color=fff",
        };

        if (!identity || !identity.istokId) setIdentity(devIdentity);

        setFailedAttempts(0);
        setLoading(false);
        onAuthSuccess();
        return;
      }
    }

    const isValid = await verifySystemPin(pinInput);
    if (isValid) {
      setFailedAttempts(0);
      setLoading(false);
      onAuthSuccess();
      return;
    }

    const newCount = failedAttempts + 1;
    setFailedAttempts(newCount);
    setPinInput("");
    triggerShake();

    if (newCount >= MAX_ATTEMPTS) {
      setLockoutUntil(Date.now() + LOCKOUT_DURATION_MS);
      setIsHardLocked(true);
      setNiceError(`SYSTEM LOCKED FOR ${LOCKOUT_DURATION_MS / 60000} MINS`);
    } else {
      setNiceError(`INVALID PASSCODE (${MAX_ATTEMPTS - newCount} attempts left)`);
    }

    setLoading(false);
  };

  if (stage === "CHECKING") {
    return (
      <div className="fixed inset-0 bg-[color:var(--bg)] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-[color:var(--primary)]/20 border-t-[color:var(--primary)] rounded-full animate-spin"></div>
          <p className="text-[color:var(--text-muted)] text-xs font-semibold tracking-[0.25em] animate-pulse">
            RESTORING IDENTITY...
          </p>
        </div>
      </div>
    );
  }

  if (stage === "BIOMETRIC_SCAN") {
    return (
      <div className="fixed inset-0 z-[9999] bg-[color:var(--bg)] flex flex-col items-center justify-center animate-fade-in text-[color:var(--primary)]">
        <div className="relative mb-8">
          <ScanFace size={64} strokeWidth={1} className="animate-pulse" />
          <div className="absolute inset-0 border-4 border-[color:var(--primary)]/20 rounded-full animate-[spin_3s_linear_infinite] w-full h-full scale-150 border-t-[color:var(--primary)]"></div>
        </div>
        <h2 className="text-lg font-semibold tracking-[0.2em] uppercase">{bioStatus}</h2>
        <button onClick={() => setStage("LOCKED")} className="mt-8 text-text-muted text-xs font-medium hover:text-text">
          USE PIN
        </button>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[9999] bg-[color:var(--bg)] text-text font-sans select-none">
      <div className="h-full w-full overflow-y-auto">
        <div
          className="min-h-full flex items-center justify-center px-5"
          style={{
            minHeight: "var(--auth-vh, 100dvh)",
            paddingTop: "calc(env(safe-area-inset-top) + 2rem)",
            paddingBottom: "calc(env(safe-area-inset-bottom) + var(--keyboard-offset, 0px) + 2rem)",
          }}
        >
          <div className={`w-full max-w-md ${shake ? "animate-[shake_0.5s_cubic-bezier(.36,.07,.19,.97)_both]" : ""}`}>
            <div className={`${authStyles.card} ${isTransitioning ? 'animate-scale-out' : ''}`}>
          {stage === "WELCOME" && (
            <div className="text-center space-y-7 animate-slide-up">
              <div className="space-y-3">
                <p className="text-lg font-bold text-text tracking-[0.4em] uppercase">ISTOIC</p>
                <h1 className="text-2xl font-semibold text-text tracking-tight">Sign in to your workspace</h1>
              </div>

              <div className="space-y-4">
                <button
                  onClick={handleGoogleLogin}
                  disabled={loading}
                  className={authStyles.buttonPrimary}
                >
                  {loading ? <Loader2 size={18} className="animate-spin" /> : <Chrome size={18} className="text-[color:var(--primary-contrast)]" />}
                  Lanjutkan dengan Google
                </button>

                <div className="flex items-center gap-3 px-2 text-xs text-text-muted">
                  <div className="h-px bg-[color:var(--border)] flex-1"></div>
                  <span className="font-semibold uppercase tracking-[0.2em]">atau</span>
                  <div className="h-px bg-[color:var(--border)] flex-1"></div>
                </div>

                <button
                  onClick={() => setStage("LOGIN_MANUAL")}
                  disabled={loading}
                  className={authStyles.buttonSecondary}
                >
                  <Mail size={18} className="text-[color:var(--primary)]" />
                  Login dengan Email
                </button>

                <div className="space-y-2 pt-2">
                  <button
                    onClick={() => setStage("REGISTER_MANUAL")}
                    disabled={loading}
                    className={authStyles.linkMuted + " mx-auto flex items-center gap-2"}
                  >
                    Buat akun baru
                  </button>

                  <button
                    onClick={() => setStage("FORGOT_ACCOUNT")}
                    className="text-xs font-semibold text-text-muted hover:text-text transition-colors flex items-center gap-2 mx-auto"
                  >
                    <HelpCircle size={12} /> Lupa akun?
                  </button>

                  {isSystemPinConfigured() && (
                    <button
                      onClick={() => setStage("LOCKED")}
                      className="text-xs font-semibold text-text-muted hover:text-text transition-colors flex items-center gap-2 mx-auto"
                    >
                      <KeyRound size={12} /> Akses perangkat
                    </button>
                  )}
                </div>
              </div>

              {error && <div className={authStyles.alertError}>{error}</div>}
            </div>
          )}

          {stage === "CREATE_ID" && (
            <div className="space-y-6 animate-slide-up">
              <div className="text-center">
                <h2 className={authStyles.title}>Setup Identitas</h2>
                <p className="text-sm text-text-muted mt-2">Buat callsign unik untuk jaringan IStok.</p>
              </div>

              <div className="bg-[color:var(--surface-2)] border border-[color:var(--border)] rounded-[var(--radius-lg)] px-4 py-4 focus-within:border-[color:var(--primary)] transition-all flex items-center shadow-[var(--shadow-soft)]">
                <span className="text-[color:var(--primary)] font-semibold text-sm mr-1 select-none">ISTOIC-</span>
                <input
                  value={codename}
                  onChange={(e) => setCodename(e.target.value.replace(/[^a-zA-Z0-9]/g, "").toUpperCase())}
                  className="bg-transparent border-none outline-none text-[color:var(--text)] font-semibold text-lg w-full uppercase"
                  placeholder="BARISTA"
                  maxLength={12}
                />
              </div>

              {error && <div className="text-danger text-xs text-center font-semibold">{error}</div>}

              <button
                onClick={handleCreateIdentity}
                disabled={loading}
                className={authStyles.buttonPrimary}
              >
                {loading ? <Loader2 className="animate-spin" /> : <ArrowRight />} SIMPAN & LANJUT
              </button>
            </div>
          )}

          {stage === "SETUP_PIN" && (
            <div className="space-y-6 animate-slide-up text-center">
              <div className="w-16 h-16 bg-warning/10 text-warning rounded-full flex items-center justify-center mx-auto border border-warning/20 mb-4">
                <KeyRound size={28} />
              </div>
              <h2 className={authStyles.title}>Kunci Perangkat</h2>
              <p className="text-sm text-text-muted">
                PIN ini hanya tersimpan di perangkat ini untuk enkripsi lokal. Login berikutnya HANYA menggunakan PIN ini.
              </p>

              <input
                type="password"
                inputMode="numeric"
                value={pinInput}
                onChange={(e) => setPinInput(e.target.value.slice(0, 6))}
                className="w-full bg-[color:var(--surface-2)] border border-[color:var(--border)] rounded-[var(--radius-lg)] py-5 text-center text-3xl font-semibold text-[color:var(--text)] tracking-[0.4em] focus:border-[color:var(--primary)] outline-none shadow-[var(--shadow-soft)]"
                placeholder="****"
              />

              {error && <p className="text-danger text-xs font-semibold">{error}</p>}

              <button onClick={handleSetupPin} className={authStyles.buttonPrimary}>
                SET PASSCODE
              </button>
            </div>
          )}

          {stage === "LOCKED" && (
            <form onSubmit={handleUnlock} className="space-y-6 animate-slide-up">
              <div className="text-center space-y-2 mb-8">
                <div
                  className={`w-20 h-20 rounded-3xl mx-auto flex items-center justify-center mb-4 transition-all duration-500 ${
                    isHardLocked
                      ? "bg-danger/15 text-danger"
                      : "bg-success/15 text-success shadow-[0_0_40px_-10px_rgba(34,197,94,0.2)]"
                  }`}
                >
                  {isHardLocked ? <Lock size={32} /> : identity ? <Fingerprint size={32} /> : <Terminal size={32} />}
                </div>
                <h2 className="text-xl font-semibold text-text tracking-tight">
                  {identity?.displayName || "SYSTEM LOCKED"}
                </h2>
                <p className="text-xs font-mono text-text-muted tracking-wider">{identity?.istokId || "AUTH_REQUIRED"}</p>
              </div>

              <div className="space-y-4">
                {isHardLocked ? (
                  <div className="p-4 bg-danger/10 border border-danger/20 rounded-[var(--radius-lg)] text-center">
                    <div className="flex flex-col items-center gap-2">
                      <ShieldAlert size={24} className="text-danger" />
                      <p className="text-xs font-semibold text-danger uppercase tracking-widest">SECURITY LOCKOUT</p>
                    </div>
                    <p className="text-2xl font-mono text-text font-semibold mt-2">
                      00:{Math.floor(countdown / 60)
                        .toString()
                        .padStart(2, "0")}
                      :{Math.floor(countdown % 60)
                        .toString()
                        .padStart(2, "0")}
                    </p>
                  </div>
                ) : (
                  <input
                    ref={inputRef}
                    type="password"
                    inputMode="numeric"
                    value={pinInput}
                    onChange={(e) => {
                      setPinInput(e.target.value.slice(0, 6));
                      setError(null);
                    }}
                    className={`w-full bg-[color:var(--surface-2)] border rounded-[var(--radius-lg)] py-5 text-center text-3xl font-semibold text-[color:var(--text)] tracking-[0.4em] focus:outline-none transition-all placeholder:text-text-muted shadow-[var(--shadow-soft)] ${
                      error ? "border-danger/50" : "border-[color:var(--border)] focus:border-[color:var(--primary)]"
                    }`}
                    placeholder="******"
                    disabled={loading}
                    autoComplete="off"
                  />
                )}

                {error && !isHardLocked && (
                  <p className="text-center text-xs text-danger font-semibold tracking-widest">{error}</p>
                )}
              </div>

              {!isHardLocked && (
                <div className="space-y-4">
                  <button
                    type="submit"
                    disabled={loading || pinInput.length < 4}
                    className={authStyles.buttonPrimary}
                  >
                    {loading ? <Loader2 className="animate-spin" /> : <ArrowRight />} BUKA
                  </button>

                  {bioEnabled && (
                    <button
                      type="button"
                      onClick={handleBiometricScan}
                      className="w-full py-3 bg-success/10 hover:bg-success/20 text-success rounded-[var(--radius-lg)] font-semibold text-xs tracking-widest flex items-center justify-center gap-2 transition-all active:scale-[0.99] border border-success/30"
                    >
                      <ScanFace size={16} /> RETRY FACE ID
                    </button>
                  )}

                  <div className="flex justify-between items-center px-1">
                    <button
                      type="button"
                      onClick={() => setStage("FORGOT_PIN")}
                      className="text-text-muted text-xs font-semibold tracking-widest hover:text-text transition-colors"
                    >
                      LUPA PIN?
                    </button>
                    <button
                      type="button"
                      onClick={() => setStage("WELCOME")}
                      className="text-text-muted text-xs font-semibold tracking-widest hover:text-text transition-colors"
                    >
                      GANTI AKUN
                    </button>
                  </div>
                </div>
              )}
            </form>
          )}

          {stage === "LOGIN_MANUAL" && (
            <LoginManual
              onBack={() => setStage("WELCOME")}
              onForgot={() => setStage("FORGOT_ACCOUNT")}
              onSuccess={handleAuthSuccess}
            />
          )}

          {stage === "REGISTER_MANUAL" && (
            <RegisterManual
              onBack={() => setStage("WELCOME")}
              onSuccess={handleAuthSuccess}
              onGoogle={handleGoogleLogin}
            />
          )}

          {stage === "FORGOT_PIN" && (
            <ForgotPin
              onBack={() => setStage("LOCKED")}
              expectedEmail={identity?.email}
              onSuccess={() => {
                setPinInput("");
                setStage("LOCKED");
              }}
            />
          )}

          {stage === "FORGOT_ACCOUNT" && <ForgotAccount onBack={() => setStage("WELCOME")} />}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
