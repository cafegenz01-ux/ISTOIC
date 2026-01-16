import React, { useMemo, useState } from 'react';
import {
  Mail,
  Lock,
  ArrowRight,
  ArrowLeft,
  KeyRound,
  ShieldCheck,
  Loader2,
  RefreshCw,
  Send,
  CheckCircle2,
  HelpCircle,
  AlertTriangle,
  User,
  Eye,
  EyeOff,
  Chrome,
} from 'lucide-react';
import { FormField } from '../../components/ui/FormField';
import { auth, db, ensureAuthPersistence, firebaseConfigError } from '../../services/firebaseConfig';
import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  updateProfile,
} from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { IstokIdentityService, IStokUserIdentity } from '../istok/services/istokIdentity';
import { setSystemPin } from '../../utils/crypto';
import { authStyles } from './authStyles';

const AUTH_TIMEOUT_MS = 20000;

const withTimeout = async <T,>(promise: Promise<T>, timeoutMs = AUTH_TIMEOUT_MS): Promise<T> => {
  return new Promise<T>((resolve, reject) => {
    let isResolved = false;
    const timer = setTimeout(() => {
      if (!isResolved) {
        isResolved = true;
        reject(new Error('Request timeout. Coba lagi.'));
      }
    }, timeoutMs);
    
    promise
      .then((value) => {
        if (!isResolved) {
          isResolved = true;
          clearTimeout(timer);
          resolve(value);
        }
      })
      .catch((error) => {
        if (!isResolved) {
          isResolved = true;
          clearTimeout(timer);
          reject(error);
        }
      });
  });
};

export const isValidEmail = (value: string) => /\S+@\S+\.\S+/.test(value);

export const normalizeAuthError = (error: any): string => {
  const message = error?.message || 'An error occurred. Please try again.';
  const code = error?.code || '';

  if (code === 'auth/invalid-credential' || message.includes('invalid-credential')) {
    return 'Invalid email or password.';
  }
  if (code === 'auth/user-not-found' || message.includes('user-not-found')) {
    return 'Account not found.';
  }
  if (code === 'auth/wrong-password' || message.includes('wrong-password')) {
    return 'Incorrect password.';
  }
  if (code === 'auth/email-already-in-use' || message.includes('email-already-in-use')) {
    return 'Email already registered.';
  }
  if (code === 'auth/weak-password' || message.includes('weak-password')) {
    return 'Password too weak. Use at least 8 characters.';
  }
  if (code === 'auth/network-request-failed') {
    return 'Network issue. Please check your connection.';
  }

  return message;
};

type ManualAuthSuccess = (identity: IStokUserIdentity) => void;

const buildFallbackIdentity = (uid: string, email: string, displayName?: string): IStokUserIdentity => {
  const baseName = displayName?.trim() || email.split('@')[0] || 'USER';
  return {
    uid,
    email,
    displayName: baseName,
    photoURL: '',
    istokId: IstokIdentityService.formatId(baseName),
    codename: baseName.toUpperCase(),
  };
};

const AuthAlert: React.FC<{ tone: 'error' | 'info' | 'success'; message: string }> = ({ tone, message }) => {
  const className =
    tone === 'error' ? authStyles.alertError : tone === 'success' ? authStyles.alertSuccess : authStyles.alertInfo;

  return (
    <div className={className} role="status">
      {tone === 'error' && <AlertTriangle size={12} />}
      {message}
    </div>
  );
};

export const LoginManual: React.FC<{ onBack: () => void; onSuccess: ManualAuthSuccess; onForgot: () => void }> = ({
  onBack,
  onSuccess,
  onForgot,
}) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  const handleLogin = async () => {
    if (firebaseConfigError || !auth) {
      setError('Service temporarily unavailable. Please try again.');
      return;
    }
    if (!isValidEmail(email)) {
      setError('Please enter a valid email address.');
      return;
    }
    if (!password) {
      setError('Password is required.');
      return;
    }

    // Prevent multiple simultaneous attempts
    if (loading) return;

    setLoading(true);
    setError('');
    setInfo('');

    try {
      await ensureAuthPersistence('local');
      const userCredential = await withTimeout(signInWithEmailAndPassword(auth, email, password));
      const user = userCredential.user;

      if (!user.emailVerified) {
        try {
          await withTimeout(sendEmailVerification(user));
          setInfo('Email not verified. Verification link sent.');
        } catch (e) {
          console.warn('Failed to send verification email', e);
        }
      }

      let identity: IStokUserIdentity | null = null;
      if (db) {
        try {
          const snap = await withTimeout(getDoc(doc(db, 'users', user.uid)));
          if (snap.exists()) {
            identity = snap.data() as IStokUserIdentity;
          }
        } catch (e) {
          console.warn('Failed to fetch user profile', e);
        }
      }

      if (!identity) {
        identity = buildFallbackIdentity(user.uid, email, user.displayName || undefined);
        await IstokIdentityService.createProfile(identity);
      }

      onSuccess(identity);
    } catch (e: any) {
      setError(normalizeAuthError(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full animate-slide-up">
      <div className="text-center mb-6">
        <h2 className={authStyles.title}>Login Email</h2>
        <p className={authStyles.subtitle}>Secure login access</p>
      </div>

      {error && (
        <p className="text-sm text-text-muted text-center mt-4 px-4">
          {error}
        </p>
      )}
      {info && (
        <p className="text-sm text-success text-center mt-4 px-4">
          {info}
        </p>
      )}

      <div className="space-y-4">
        <FormField label="Email Address">
          <div className="relative">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={authStyles.inputIconWrap}
              placeholder="nama@email.com"
              autoComplete="email"
              disabled={loading}
            />
            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted" size={18} />
          </div>
        </FormField>
        <FormField label="Password">
          <div className="relative">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={authStyles.inputIconWrap}
              placeholder="********"
              autoComplete="current-password"
              disabled={loading}
            />
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted" size={18} />
          </div>
        </FormField>
        <button onClick={handleLogin} disabled={loading} className={authStyles.buttonPrimary}>
          {loading ? (
            <>
              <div className="flex items-center gap-2">
                <div className="flex gap-1">
                  <div className="w-1 h-1 bg-current rounded-full animate-pulse" style={{ animationDelay: '0ms' }}></div>
                  <div className="w-1 h-1 bg-current rounded-full animate-pulse" style={{ animationDelay: '150ms' }}></div>
                  <div className="w-1 h-1 bg-current rounded-full animate-pulse" style={{ animationDelay: '300ms' }}></div>
                </div>
                Signing in…
              </div>
            </>
          ) : (
            <>
              <ArrowRight size={16} /> MASUK
            </>
          )}
        </button>
        <button onClick={onForgot} className={authStyles.linkMuted} disabled={loading}>
          LUPA AKUN?
        </button>
      </div>

      <button onClick={onBack} className={authStyles.buttonGhost} disabled={loading}>
        <ArrowLeft size={12} /> KEMBALI
      </button>
    </div>
  );
};

export const RegisterManual: React.FC<{ onBack: () => void; onSuccess: ManualAuthSuccess; onGoogle: () => void }> = ({ onBack, onSuccess, onGoogle }) => {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  const handleRegister = async () => {
    if (firebaseConfigError || !auth) {
      setError(firebaseConfigError || 'Firebase belum dikonfigurasi.');
      return;
    }
    if (!fullName.trim()) {
      setError('Nama wajib diisi.');
      return;
    }
    if (!isValidEmail(email)) {
      setError('Format email tidak valid.');
      return;
    }
    if (password.length < 8) {
      setError('Password minimal 8 karakter.');
      return;
    }

    // Prevent multiple simultaneous attempts
    if (loading) return;

    setLoading(true);
    setError('');
    setInfo('');

    try {
      await ensureAuthPersistence('local');
      const userCredential = await withTimeout(createUserWithEmailAndPassword(auth, email, password));

      if (fullName.trim()) {
        try {
          await withTimeout(updateProfile(userCredential.user, { displayName: fullName.trim() }));
        } catch (e) {
          console.warn('Failed to update profile', e);
        }
      }

      try {
        await withTimeout(sendEmailVerification(userCredential.user));
      } catch (e) {
        console.warn('Failed to send verification email', e);
      }

      const identity = buildFallbackIdentity(userCredential.user.uid, email, fullName.trim());
      await IstokIdentityService.createProfile(identity);

      setInfo('Email verifikasi dikirim. Silakan cek inbox Anda.');
      onSuccess(identity);
    } catch (e: any) {
      setError(normalizeAuthError(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full animate-slide-up">
      <div className="text-center space-y-3">
        <p className="text-lg font-bold text-text tracking-[0.4em] uppercase">ISTOIC</p>
        <h1 className="text-2xl font-semibold text-text tracking-tight">Create your ISTOIC account</h1>
        <p className="text-sm text-text-muted">Join thousands of users for productivity</p>
      </div>

      {error && (
        <p className="text-sm text-text-muted text-center mt-4 px-4">
          {error}
        </p>
      )}
      {info && (
        <p className="text-sm text-success text-center mt-4 px-4">
          {info}
        </p>
      )}

      <div className="space-y-4 mt-7">
        <input
          type="text"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          className={authStyles.input}
          placeholder="Full name"
          autoComplete="name"
          disabled={loading}
        />
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={authStyles.input}
          placeholder="email@address.com"
          autoComplete="email"
          disabled={loading}
        />
        <div className="relative">
          <input
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={authStyles.input}
            placeholder="Password (minimum 8 characters)"
            autoComplete="new-password"
            disabled={loading}
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-text-muted hover:text-text"
            disabled={loading}
          >
            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>

        <button onClick={handleRegister} disabled={loading} className={authStyles.buttonPrimary}>
          {loading ? (
            <>
              <div className="flex items-center gap-2">
                <div className="flex gap-1">
                  <div className="w-1 h-1 bg-current rounded-full animate-pulse" style={{ animationDelay: '0ms' }}></div>
                  <div className="w-1 h-1 bg-current rounded-full animate-pulse" style={{ animationDelay: '150ms' }}></div>
                  <div className="w-1 h-1 bg-current rounded-full animate-pulse" style={{ animationDelay: '300ms' }}></div>
                </div>
                Creating account…
              </div>
            </>
          ) : (
            <>
              <ArrowRight size={16} /> Create account
            </>
          )}
        </button>

        <div className="flex items-center gap-3 px-2 text-xs text-text-muted">
          <div className="h-px bg-[color:var(--border)] flex-1"></div>
          <span className="font-semibold uppercase tracking-[0.2em]">or</span>
          <div className="h-px bg-[color:var(--border)] flex-1"></div>
        </div>

        <button onClick={onGoogle} disabled={loading} className={authStyles.buttonSecondary}>
          <Chrome size={16} className="text-[color:var(--primary)]" /> Continue with Google
        </button>

        <div className="space-y-2 pt-2">
          <button onClick={onBack} className={authStyles.linkMuted + " mx-auto flex items-center gap-2"} disabled={loading}>
            Already have an account? Sign in
          </button>
          <p className="text-xs text-text-muted text-center">
            By creating an account, you agree to our <a href="#" className="underline hover:text-text">Terms & Conditions</a>.
          </p>
        </div>
      </div>
    </div>
  );
};

export const ForgotPin: React.FC<{ onBack: () => void; onSuccess: () => void; expectedEmail?: string }> = ({
  onBack,
  onSuccess,
  expectedEmail,
}) => {
  const [loading, setLoading] = useState(false);
  const [newPin, setNewPin] = useState('');
  const [emailCheck, setEmailCheck] = useState('');
  const [ackRisk, setAckRisk] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [emailSent, setEmailSent] = useState(false);

  const handleSendEmail = async () => {
    if (!expectedEmail || !isValidEmail(expectedEmail)) {
      setError('Email tidak valid.');
      return;
    }

    if (firebaseConfigError || !auth) {
      setError('Service temporarily unavailable. Please try again later.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await ensureAuthPersistence('local');
      // Send password reset email as verification step
      await withTimeout(sendPasswordResetEmail(auth, expectedEmail, {
        url: window.location.origin,
        handleCodeInApp: false,
      }));
      setEmailSent(true);
      setInfo('Link verifikasi telah dikirim ke email Anda. Silakan cek inbox untuk melanjutkan reset PIN.');
    } catch (e: any) {
      const errorMsg = normalizeAuthError(e);
      // If email not found, still allow local PIN reset with warning
      if (errorMsg.includes('user-not-found') || errorMsg.includes('not found')) {
        setError('Email tidak terdaftar. Anda dapat reset PIN lokal dengan risiko kehilangan data terenkripsi.');
      } else {
        setError(`Gagal mengirim email: ${errorMsg}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async () => {
    if (expectedEmail && emailCheck.trim().toLowerCase() !== expectedEmail.toLowerCase()) {
      setError('Email tidak cocok dengan akun yang tersimpan.');
      return;
    }
    if (newPin.length < 4) {
      setError('PIN minimal 4 digit.');
      return;
    }
    if (!ackRisk) {
      setError('Konfirmasi risiko harus disetujui.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await withTimeout(setSystemPin(newPin));
      setInfo('PIN baru berhasil diatur.');
      onSuccess();
    } catch (e: any) {
      setError(e?.message || 'Gagal mengatur PIN baru.');
    } finally {
      setLoading(false);
    }
  };

  if (emailSent) {
    return (
      <div className="w-full animate-slide-up">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 mx-auto bg-success/10 rounded-full flex items-center justify-center border border-success/20 mb-4 text-success">
            <CheckCircle2 size={32} />
          </div>
          <h2 className={authStyles.title}>Email Terkirim</h2>
          <p className="text-sm text-text-muted">
            Link verifikasi telah dikirim ke <strong>{expectedEmail}</strong>. 
            Silakan cek inbox dan ikuti instruksi untuk reset PIN.
          </p>
          {info && <AuthAlert tone="success" message={info} />}
        </div>

        <div className="mt-8 space-y-4">
          <button
            onClick={() => {
              setEmailSent(false);
              setInfo('');
            }}
            className={authStyles.buttonSecondary}
          >
            <ArrowLeft size={16} /> Kembali
          </button>
          <button onClick={onBack} className={authStyles.buttonGhost}>
            BATAL
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full animate-slide-up">
      <div className="text-center mb-6">
        <div className="w-16 h-16 mx-auto bg-warning/10 rounded-full flex items-center justify-center border border-warning/20 mb-4 text-warning">
          <KeyRound size={32} />
        </div>
        <h2 className={authStyles.title}>Reset PIN Akses</h2>
        <p className="text-xs text-text-muted mt-2 max-w-[250px] mx-auto leading-relaxed">
          PIN hanya tersimpan di perangkat ini. Reset PIN akan membuat data terenkripsi lama tidak terbuka.
        </p>
      </div>

      {error && <AuthAlert tone="error" message={error} />}
      {info && <AuthAlert tone="success" message={info} />}

      <div className="space-y-4">
        {expectedEmail && (
          <>
            <div className="bg-surface-2 border border-border rounded-lg p-4 mb-4">
              <p className="text-xs text-text-muted mb-2">Email terdaftar:</p>
              <p className="text-sm font-semibold text-text">{expectedEmail}</p>
            </div>
            <button
              onClick={handleSendEmail}
              disabled={loading}
              className={authStyles.buttonSecondary}
            >
              {loading ? <Loader2 className="animate-spin" /> : <Send size={16} />} Kirim Link Verifikasi ke Email
            </button>
            <div className="flex items-center gap-3 px-2 text-xs text-text-muted">
              <div className="h-px bg-[color:var(--border)] flex-1"></div>
              <span className="font-semibold uppercase tracking-[0.2em]">atau</span>
              <div className="h-px bg-[color:var(--border)] flex-1"></div>
            </div>
            <FormField label="Konfirmasi email akun">
              <input
                type="email"
                value={emailCheck}
                onChange={(e) => setEmailCheck(e.target.value)}
                className={authStyles.input}
                placeholder="Masukkan email untuk verifikasi"
                autoComplete="email"
              />
            </FormField>
          </>
        )}
        <FormField label="PIN baru">
          <input
            type="password"
            inputMode="numeric"
            maxLength={6}
            value={newPin}
            onChange={(e) => setNewPin(e.target.value.replace(/[^0-9]/g, ''))}
            className={`${authStyles.input} text-center text-2xl font-mono tracking-[0.5em]`}
            placeholder="BARU"
          />
        </FormField>
        <label className="flex items-start gap-2 text-xs text-text-muted">
          <input
            type="checkbox"
            checked={ackRisk}
            onChange={(e) => setAckRisk(e.target.checked)}
            className="mt-0.5 accent-[color:var(--primary)]"
          />
          Saya memahami bahwa reset PIN dapat membuat data terenkripsi lama tidak bisa diakses.
        </label>

        <button
          onClick={handleReset}
          disabled={loading || newPin.length < 4 || !ackRisk}
          className={authStyles.buttonPrimary}
        >
          {loading ? <Loader2 className="animate-spin" /> : <RefreshCw size={16} />} ATUR ULANG PIN
        </button>
      </div>

      <button onClick={onBack} className={authStyles.buttonGhost}>
        BATAL
      </button>
    </div>
  );
};

export const ForgotAccount: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  const handleSendReset = async () => {
    if (firebaseConfigError || !auth) {
      setError('Service temporarily unavailable. Please try again later.');
      return;
    }
    if (!isValidEmail(email)) {
      setError('Please enter a valid email address.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await ensureAuthPersistence('local');
      await withTimeout(sendPasswordResetEmail(auth, email));
      setSent(true);
    } catch (e: any) {
      setError('Unable to send reset email. Please check your email address and try again.');
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <div className="w-full animate-slide-up">
        <div className="text-center space-y-4">
          <p className="text-lg font-bold text-text tracking-[0.4em] uppercase">ISTOIC</p>
          <h1 className="text-2xl font-semibold text-text tracking-tight">Check your email</h1>
          <p className="text-sm text-text-muted">We've sent a secure reset link to your email.</p>
        </div>

        <div className="mt-8">
          <button onClick={onBack} className={authStyles.buttonPrimary}>
            Back to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full animate-slide-up">
      <div className="text-center space-y-4">
        <p className="text-lg font-bold text-text tracking-[0.4em] uppercase">ISTOIC</p>
        <h1 className="text-2xl font-semibold text-text tracking-tight">Reset your password</h1>
        <p className="text-sm text-text-muted">Enter your email and we'll send you a secure reset link.</p>
      </div>

      {error && (
        <p className="text-sm text-text-muted text-center mt-4 px-4">
          {error}
        </p>
      )}

      <div className="space-y-4 mt-8">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={`${authStyles.input} py-4 min-h-[48px]`}
          placeholder="Email address"
          autoComplete="email"
          disabled={loading}
        />

        <button onClick={handleSendReset} disabled={loading || !email.trim()} className={authStyles.buttonPrimary}>
          {loading ? (
            <>
              <div className="flex items-center gap-2">
                <div className="flex gap-1">
                  <div className="w-1 h-1 bg-current rounded-full animate-pulse" style={{ animationDelay: '0ms' }}></div>
                  <div className="w-1 h-1 bg-current rounded-full animate-pulse" style={{ animationDelay: '150ms' }}></div>
                  <div className="w-1 h-1 bg-current rounded-full animate-pulse" style={{ animationDelay: '300ms' }}></div>
                </div>
                Sending link…
              </div>
            </>
          ) : (
            'Send reset link'
          )}
        </button>

        <div className="pt-4">
          <button onClick={onBack} className={authStyles.linkMuted + " mx-auto flex items-center gap-2"}>
            Back to Login
          </button>
        </div>
      </div>
    </div>
  );
};
