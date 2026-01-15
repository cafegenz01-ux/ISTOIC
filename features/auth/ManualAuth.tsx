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

const AUTH_TIMEOUT_MS = 15000;

const withTimeout = async <T,>(promise: Promise<T>, timeoutMs = AUTH_TIMEOUT_MS): Promise<T> =>
  new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Request timeout. Coba lagi.')), timeoutMs);
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

export const isValidEmail = (value: string) => /\S+@\S+\.\S+/.test(value);

export const normalizeAuthError = (error: any): string => {
  const message = error?.message || 'Terjadi kesalahan. Coba lagi.';
  const code = error?.code || '';

  if (code === 'auth/invalid-credential' || message.includes('invalid-credential')) {
    return 'Email atau password salah.';
  }
  if (code === 'auth/user-not-found' || message.includes('user-not-found')) {
    return 'Akun tidak ditemukan.';
  }
  if (code === 'auth/wrong-password' || message.includes('wrong-password')) {
    return 'Password salah.';
  }
  if (code === 'auth/email-already-in-use' || message.includes('email-already-in-use')) {
    return 'Email sudah terdaftar.';
  }
  if (code === 'auth/weak-password' || message.includes('weak-password')) {
    return 'Password terlalu lemah. Gunakan minimal 8 karakter.';
  }
  if (code === 'auth/network-request-failed') {
    return 'Koneksi bermasalah. Periksa jaringan Anda.';
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
      setError(firebaseConfigError || 'Firebase belum dikonfigurasi.');
      return;
    }
    if (!isValidEmail(email)) {
      setError('Format email tidak valid.');
      return;
    }
    if (!password) {
      setError('Password wajib diisi.');
      return;
    }

    setLoading(true);
    setError('');
    setInfo('');

    try {
      await ensureAuthPersistence('local');
      const userCredential = await withTimeout(signInWithEmailAndPassword(auth, email, password));
      const user = userCredential.user;

      if (!user.emailVerified) {
        await withTimeout(sendEmailVerification(user));
        setInfo('Email belum diverifikasi. Link verifikasi dikirim ulang.');
      }

      let identity: IStokUserIdentity | null = null;
      if (db) {
        const snap = await withTimeout(getDoc(doc(db, 'users', user.uid)));
        if (snap.exists()) {
          identity = snap.data() as IStokUserIdentity;
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

      {error && <AuthAlert tone="error" message={error} />}
      {info && <AuthAlert tone="info" message={info} />}

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
            />
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted" size={18} />
          </div>
        </FormField>
        <button onClick={handleLogin} disabled={loading} className={authStyles.buttonPrimary}>
          {loading ? <Loader2 className="animate-spin" size={16} /> : <ArrowRight size={16} />} MASUK
        </button>
        <button onClick={onForgot} className={authStyles.linkMuted}>
          LUPA AKUN?
        </button>
      </div>

      <button onClick={onBack} className={authStyles.buttonGhost}>
        <ArrowLeft size={12} /> KEMBALI
      </button>
    </div>
  );
};

export const RegisterManual: React.FC<{ onBack: () => void; onSuccess: ManualAuthSuccess }> = ({ onBack, onSuccess }) => {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  const passwordScore = useMemo(() => {
    if (!password) return 'empty';
    if (password.length < 8) return 'weak';
    if (/[A-Z]/.test(password) && /[0-9]/.test(password)) return 'strong';
    return 'medium';
  }, [password]);

  const handleRegister = async () => {
    if (firebaseConfigError || !auth) {
      setError(firebaseConfigError || 'Firebase belum dikonfigurasi.');
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
    if (password !== confirmPassword) {
      setError('Konfirmasi password tidak sama.');
      return;
    }

    setLoading(true);
    setError('');
    setInfo('');

    try {
      await ensureAuthPersistence('local');
      const userCredential = await withTimeout(createUserWithEmailAndPassword(auth, email, password));

      if (fullName.trim()) {
        await withTimeout(updateProfile(userCredential.user, { displayName: fullName.trim() }));
      }

      await withTimeout(sendEmailVerification(userCredential.user));

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
      <div className="text-center mb-6">
        <h2 className={authStyles.title}>Daftar Akun</h2>
        <p className={authStyles.subtitle}>Secure encrypted registration</p>
      </div>

      {error && <AuthAlert tone="error" message={error} />}
      {info && <AuthAlert tone="success" message={info} />}

      <div className="space-y-4">
        <FormField label="Nama Lengkap">
          <div className="relative">
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className={authStyles.inputIconWrap}
              placeholder="Nama Anda"
              autoComplete="name"
            />
            <User className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted" size={18} />
          </div>
        </FormField>
        <FormField label="Email Address">
          <div className="relative">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={authStyles.inputIconWrap}
              placeholder="nama@email.com"
              autoComplete="email"
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
              placeholder="Minimal 8 karakter"
              autoComplete="new-password"
            />
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted" size={18} />
          </div>
          <p
            className={`text-xs font-semibold ${
              passwordScore === 'strong'
                ? 'text-success'
                : passwordScore === 'medium'
                  ? 'text-warning'
                  : 'text-text-muted'
            }`}
          >
            {passwordScore === 'empty'
              ? 'Gunakan kombinasi huruf, angka, dan simbol.'
              : passwordScore === 'weak'
                ? 'Password lemah, tambah panjang dan variasi.'
                : passwordScore === 'medium'
                  ? 'Password cukup, tambah angka/huruf besar untuk kuat.'
                  : 'Password kuat.'}
          </p>
        </FormField>
        <FormField label="Konfirmasi Password">
          <div className="relative">
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className={authStyles.inputIconWrap}
              placeholder="Ulangi password"
              autoComplete="new-password"
            />
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted" size={18} />
          </div>
        </FormField>
        <button onClick={handleRegister} disabled={loading} className={authStyles.buttonSecondary}>
          {loading ? <Loader2 className="animate-spin" size={16} /> : <ShieldCheck size={16} />} SELESAI & MASUK
        </button>
      </div>

      <button onClick={onBack} className={authStyles.buttonGhost}>
        <ArrowLeft size={12} /> KEMBALI
      </button>
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
          <FormField label="Email akun">
            <input
              type="email"
              value={emailCheck}
              onChange={(e) => setEmailCheck(e.target.value)}
              className={authStyles.input}
              placeholder="Konfirmasi email akun"
              autoComplete="email"
            />
          </FormField>
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
          disabled={loading}
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
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');

  const handleSendReset = async () => {
    if (firebaseConfigError || !auth) {
      setError(firebaseConfigError || 'Firebase belum dikonfigurasi.');
      return;
    }
    if (!isValidEmail(email)) {
      setError('Format email tidak valid');
      return;
    }

    setLoading(true);
    setError('');
    setStatus('');

    try {
      await ensureAuthPersistence('local');
      await withTimeout(sendPasswordResetEmail(auth, email));
      setStatus('Link reset password dikirim ke email Anda.');
    } catch (e: any) {
      setError(normalizeAuthError(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full animate-slide-up">
      <div className="text-center mb-8">
        <div className="w-16 h-16 mx-auto bg-primary/10 rounded-full flex items-center justify-center border border-primary/20 mb-4 text-primary">
          <HelpCircle size={32} />
        </div>
        <h2 className={authStyles.title}>Pemulihan Akun</h2>
        <p className="text-xs text-text-muted mt-2">Masukkan email terdaftar untuk menerima link reset password.</p>
      </div>

      <div className="space-y-3">
        <div className="p-4 bg-surface-2 rounded-[var(--radius-lg)] border border-border text-left space-y-3">
          <h4 className="text-xs font-semibold text-text flex items-center gap-2">
            <Mail size={12} className="text-primary" /> Email Recovery
          </h4>
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={`${authStyles.input} flex-1`}
              placeholder="email@anda.com"
              autoComplete="email"
            />
            <button
              onClick={handleSendReset}
              disabled={loading}
              className="px-4 py-3 rounded-[var(--radius-lg)] text-xs font-semibold bg-[color:var(--primary)] text-[color:var(--primary-contrast)] disabled:opacity-60"
            >
              {loading ? '...' : 'KIRIM'}
            </button>
          </div>
          {status && <p className="text-xs text-success">{status}</p>}
          {error && <p className="text-xs text-danger">{error}</p>}
        </div>

        <div className="p-4 bg-warning/10 rounded-[var(--radius-lg)] border border-warning/20 text-left flex gap-3">
          <AlertTriangle size={20} className="text-warning shrink-0" />
          <div>
            <h4 className="text-xs font-semibold text-warning mb-1">Manual Support</h4>
            <p className="text-xs text-text-muted">
              Jika kehilangan akses total, silakan hubungi tim IT IStoic melalui channel aman.
            </p>
          </div>
        </div>
      </div>

      <button onClick={onBack} className={authStyles.buttonGhost}>
        KEMBALI KE LOGIN
      </button>
    </div>
  );
};
