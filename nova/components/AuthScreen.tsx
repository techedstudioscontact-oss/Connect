
import React, { useState } from 'react';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { Role, UserProfile } from '../types';
import { LoadingSpinner } from './LoadingSpinner';

const AuthScreen = () => {
  const [authMode, setAuthMode] = useState<'login' | 'signup' | 'forgotPassword'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<Role>(Role.INFLUENCER);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const handleAuthAction = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');

    try {
      if (authMode === 'login') {
        await signInWithEmailAndPassword(auth, email, password);
      } else { // Signup
        if (!name) {
          setError('Name is required for signup.');
          setLoading(false);
          return;
        }
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        const userProfile: UserProfile = {
          uid: user.uid,
          name,
          email: user.email!,
          role,
          bio: '',
          website: '',
          avatar: `https://i.pravatar.cc/150?u=${user.uid}`,
          socials: {},
          followerCounts: {},
          following: [],
          likedPosts: [],
          savedPosts: [],
          savedCampaigns: []
        };
        await setDoc(doc(db, 'users', user.uid), userProfile);
      }
    } catch (err: any) {
      setError(err.message.replace('Firebase: ', ''));
    } finally {
      setLoading(false);
    }
  };
  
  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
        setError('Please enter your email address.');
        return;
    }
    setLoading(true);
    setError('');
    setMessage('');

    try {
      await sendPasswordResetEmail(auth, email);
      setMessage('Password reset email sent. Please check your inbox (and spam folder).');
      setAuthMode('login'); 
    } catch (err: any) {
      setError(err.message.replace('Firebase: ', ''));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 dark:bg-black p-4">
      <div className="w-full max-w-md p-8 space-y-6 bg-white dark:bg-gray-900 rounded-xl shadow-lg">
        <div className="flex flex-col items-center space-y-4">
          <img src="/assets/logo.svg" alt="CollabSea Logo" className="h-20 w-20 object-contain drop-shadow-md" />
          <div className="text-center">
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white font-wordmark">
                {authMode === 'login' && 'Welcome to CollabSea'}
                {authMode === 'signup' && 'Create Your Account'}
                {authMode === 'forgotPassword' && 'Reset Password'}
              </h1>
              <p className="text-gray-600 dark:text-gray-400 mt-2">
                {authMode === 'login' && 'Sign in to continue'}
                {authMode === 'signup' && 'Join the creative revolution'}
                {authMode === 'forgotPassword' && 'Enter your email to receive a password reset link.'}
              </p>
          </div>
        </div>

        {authMode === 'forgotPassword' ? (
          <form className="space-y-6" onSubmit={handlePasswordReset}>
            <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Email</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                  className="mt-1 block w-full px-4 py-3 bg-gray-100 dark:bg-gray-800 border-2 border-transparent rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent text-gray-900 dark:text-gray-100" required />
            </div>
            {error && <p className="text-sm text-red-500 text-center">{error}</p>}
            {message && <p className="text-sm text-green-500 text-center">{message}</p>}
            <div>
              <button type="submit" disabled={loading}
                className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-sky-500 hover:bg-sky-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500 disabled:opacity-50 h-12 items-center">
                {loading ? <LoadingSpinner /> : 'Send Reset Link'}
              </button>
            </div>
          </form>
        ) : (
          <form className="space-y-6" onSubmit={handleAuthAction}>
            {authMode === 'signup' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Name</label>
                <input type="text" value={name} onChange={(e) => setName(e.target.value)}
                  className="mt-1 block w-full px-4 py-3 bg-gray-100 dark:bg-gray-800 border-2 border-transparent rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent text-gray-900 dark:text-gray-100" required />
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                className="mt-1 block w-full px-4 py-3 bg-gray-100 dark:bg-gray-800 border-2 border-transparent rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent text-gray-900 dark:text-gray-100" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Password</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                className="mt-1 block w-full px-4 py-3 bg-gray-100 dark:bg-gray-800 border-2 border-transparent rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent text-gray-900 dark:text-gray-100" required />
            </div>
            {authMode === 'login' && (
                <div className="text-right -mt-2">
                    <button type="button" onClick={() => { setAuthMode('forgotPassword'); setError(''); setMessage(''); }} className="text-sm font-medium text-sky-600 hover:text-sky-500 dark:text-sky-400 dark:hover:text-sky-300 focus:outline-none">
                        Forgot Password?
                    </button>
                </div>
            )}
            {authMode === 'signup' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">I am a...</label>
                <div className="mt-2 grid grid-cols-2 gap-3">
                  <button type="button" onClick={() => setRole(Role.INFLUENCER)}
                    className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${role === Role.INFLUENCER ? 'bg-sky-500 text-white shadow-md' : 'bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200'}`}>
                    Influencer
                  </button>
                  <button type="button" onClick={() => setRole(Role.BRAND)}
                    className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${role === Role.BRAND ? 'bg-sky-500 text-white shadow-md' : 'bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200'}`}>
                    Brand
                  </button>
                </div>
              </div>
            )}
            {error && <p className="text-sm text-red-500 text-center">{error}</p>}
            {message && <p className="text-sm text-green-500 text-center">{message}</p>}
            <div>
              <button type="submit" disabled={loading}
                className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-sky-500 hover:bg-sky-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500 disabled:opacity-50 h-12 items-center">
                {loading ? <LoadingSpinner /> : (authMode === 'login' ? 'Sign In' : 'Create Account')}
              </button>
            </div>
          </form>
        )}
        
        <div className="text-center">
          <button onClick={() => { 
                setAuthMode(authMode === 'login' ? 'signup' : 'login'); 
                setError(''); 
                setMessage('');
                if (authMode === 'forgotPassword') setAuthMode('login');
            }}
            className="text-sm font-medium text-sky-600 hover:text-sky-500 dark:text-sky-400 dark:hover:text-sky-300">
            {authMode === 'login' && "Don't have an account? Sign Up"}
            {authMode === 'signup' && "Already have an account? Sign In"}
            {authMode === 'forgotPassword' && "Back to Sign In"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AuthScreen;
