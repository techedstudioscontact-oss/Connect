import React, { useState } from 'react';
import { Mail, Lock, User, ArrowRight } from 'lucide-react';
import { auth, db } from '../lib/firebase';
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  signInAnonymously,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile
} from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';

interface AuthScreenProps {
  onLogin: (userProfile: any) => void;
}

export function AuthScreen({ onLogin }: AuthScreenProps) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const saveUserToFirestore = async (user: any, nameOverwrite?: string) => {
    try {
      const userRef = doc(db, 'users', user.uid);
      await setDoc(userRef, {
        displayName: nameOverwrite || user.displayName || 'Guest User',
        photoURL: user.photoURL || 'https://images.unsplash.com/photo-1599566150163-29194dcaad36?w=150&q=80',
        email: user.email || null,
        isAnonymous: user.isAnonymous,
        lastActive: serverTimestamp()
      }, { merge: true });
    } catch (e) {
      console.error("Error saving user profile to DB:", e);
    }
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password || (!isLogin && !name)) return;
    
    setLoading(true);
    setError(null);
    try {
      if (isLogin) {
        const result = await signInWithEmailAndPassword(auth, email, password);
        await saveUserToFirestore(result.user);
        onLogin({
          uid: result.user.uid,
          name: result.user.displayName || 'User',
          avatar: result.user.photoURL || 'https://images.unsplash.com/photo-1599566150163-29194dcaad36?w=150&q=80'
        });
      } else {
        const result = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(result.user, {
          displayName: name,
        });
        await saveUserToFirestore(result.user, name);
        onLogin({
          uid: result.user.uid,
          name: name,
          avatar: 'https://images.unsplash.com/photo-1599566150163-29194dcaad36?w=150&q=80'
        });
      }
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/email-already-in-use') {
        setError('This email is already registered. Please sign in.');
      } else if (err.code === 'auth/wrong-password' || err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential') {
        setError('Invalid email or password.');
      } else if (err.code === 'auth/weak-password') {
        setError('Password should be at least 6 characters.');
      } else {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      await saveUserToFirestore(result.user);
      onLogin({
        uid: result.user.uid,
        name: result.user.displayName || 'Anonymous User',
        avatar: result.user.photoURL || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&q=80'
      });
    } catch (err: any) {
      console.error(err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGuestLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const result = await signInAnonymously(auth);
      await saveUserToFirestore(result.user);
      onLogin({
        uid: result.user.uid,
        name: 'Guest User',
        avatar: 'https://images.unsplash.com/photo-1599566150163-29194dcaad36?w=150&q=80'
      });
    } catch (err: any) {
      console.error(err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-[100dvh] w-full bg-neutral-100 flex items-center justify-center overflow-hidden relative">
      {/* Background Gradients matching the app style */}
      <div className="absolute top-0 left-0 w-[500px] h-[500px] rounded-full mix-blend-multiply filter blur-[80px] -translate-x-1/2 -translate-y-1/2" style={{ backgroundColor: 'var(--auth-circle-1)' }}></div>
      <div className="absolute top-0 right-0 w-[400px] h-[400px] rounded-full mix-blend-multiply filter blur-[80px] translate-x-1/2 -translate-y-1/4" style={{ backgroundColor: 'var(--auth-circle-2)' }}></div>
      <div className="absolute bottom-0 left-1/4 w-[600px] h-[600px] rounded-full mix-blend-multiply filter blur-[100px] translate-y-1/3" style={{ backgroundColor: 'var(--auth-circle-3)' }}></div>

      <div className="w-full max-w-[400px] p-6 relative z-10 animate-slide-up">
        <div className="text-center mb-6">
          <h1 className="text-[40px] font-black text-slate-900 tracking-tight leading-none mb-2 flex items-center justify-center gap-[1px]">
            C<span className="relative inline-flex justify-center items-center">
              o<span className="absolute w-[120%] h-[3.5px] bg-slate-900 rotate-[-45deg] rounded-full"></span>
            </span>nnect
          </h1>
          <p className="text-[15px] font-medium text-slate-500">
            {isLogin ? 'Welcome back! Ready to explore?' : 'Join the newest creative community.'}
          </p>
        </div>

        <div className="bg-white/80 backdrop-blur-xl rounded-[40px] p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white/60 space-y-5">
          <h2 className="text-[22px] font-bold text-slate-900 text-center mb-6">
            {isLogin ? 'Sign In' : 'Create Account'}
          </h2>

          {error && (
            <div className="bg-rose-50 text-rose-600 p-3 rounded-xl text-[13px] font-medium text-center">
              {error}
            </div>
          )}

          <form onSubmit={handleEmailSubmit} className="space-y-4">
            {!isLogin && (
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input 
                  type="text" 
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Full Name" 
                  className="w-full bg-slate-50/50 border border-slate-200 rounded-2xl py-3.5 pl-12 pr-4 text-[15px] font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:bg-white transition-all"
                  required={!isLogin}
                  disabled={loading}
                />
              </div>
            )}

            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input 
                type="email" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email address" 
                className="w-full bg-slate-50/50 border border-slate-200 rounded-2xl py-3.5 pl-12 pr-4 text-[15px] font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:bg-white transition-all"
                required
                disabled={loading}
              />
            </div>

            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password" 
                className="w-full bg-slate-50/50 border border-slate-200 rounded-2xl py-3.5 pl-12 pr-4 text-[15px] font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:bg-white transition-all"
                required
                disabled={loading}
              />
            </div>

            <button 
              type="submit"
              disabled={loading}
              className="w-full bg-slate-900 text-white font-bold py-4 rounded-2xl shadow-lg hover:bg-slate-800 transition-colors flex items-center justify-center gap-2 mt-2 disabled:opacity-50"
            >
              {isLogin ? 'Log In' : 'Sign Up'}
            </button>
          </form>

          <div className="relative flex items-center py-2">
            <div className="flex-grow border-t border-slate-200"></div>
            <span className="flex-shrink-0 mx-4 text-slate-400 text-[13px] font-medium">Or continue with</span>
            <div className="flex-grow border-t border-slate-200"></div>
          </div>

          <div className="flex gap-3">
            <button 
              onClick={handleGoogleLogin}
              disabled={loading}
              className="flex-1 bg-white text-slate-700 font-bold py-3.5 rounded-2xl border border-slate-200 shadow-sm hover:bg-slate-50 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
            </button>
            
            <button 
              onClick={handleGuestLogin}
              disabled={loading}
              className="flex-1 bg-slate-100 text-slate-700 font-bold py-3.5 rounded-2xl border border-slate-200 shadow-sm hover:bg-slate-200 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            >
              Guest
            </button>
          </div>
        </div>

        <div className="mt-8 text-center text-[14px] font-medium text-slate-500">
          {isLogin ? "Don't have an account?" : "Already have an account?"}
          <button 
            onClick={() => {
              setIsLogin(!isLogin);
              setError(null);
            }}
            className="ml-2 text-emerald-600 font-bold hover:text-emerald-700 transition-colors"
          >
            {isLogin ? 'Sign up' : 'Sign in'}
          </button>
        </div>
      </div>
    </div>
  );
}
