import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Link, useNavigate } from 'react-router-dom';
import { Lock, Mail, AlertCircle, FileText, ShieldAlert } from 'lucide-react';
import { useGoogleLogin } from '@react-oauth/google';
import GoogleAuthButton from './GoogleAuthButton';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [isLocked, setIsLocked] = useState(false);
  const [suspiciousActivity, setSuspiciousActivity] = useState(false);

  const { login, loginWithGoogle } = useAuth();
  const navigate = useNavigate();

  const googleLogin = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      try {
        setLoading(true);
        await loginWithGoogle(tokenResponse.access_token);
        navigate('/');
      } catch {
        setError('Google Sign-In failed. Please try again.');
        setLoading(false);
      }
    },
    onError: () => setError('Google Sign-In was unsuccessful.'),
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isLocked) return;

    setError('');
    setSuspiciousActivity(false);
    setLoading(true);
    try {
      await login(email, password);
      navigate('/');
    } catch (err) {
      const newAttempts = failedAttempts + 1;
      setFailedAttempts(newAttempts);

      if (newAttempts >= 3) {
        setIsLocked(true);
        setError('Account locked due to multiple failed login attempts. Please try again later.');
      } else {
        const errorMsg =
          err.response?.data?.error ||
          (err.code === 'ERR_NETWORK' || err.message === 'Network Error'
            ? 'Cannot connect to backend server. Please make sure server is running on port 3001.'
            : `Invalid credentials. Please try again. (${3 - newAttempts} attempts remaining)`);
        setError(errorMsg);
        if (email.includes('suspicious') || newAttempts === 2) setSuspiciousActivity(true);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md border border-gray-100">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center p-3 bg-blue-50 text-blue-600 rounded-xl mb-3">
            <FileText size={32} />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-1">Welcome Back</h1>
          <p className="text-gray-500 text-sm">Sign in to SyncWrite editor</p>
        </div>

        {/* Suspicious activity warning */}
        {suspiciousActivity && (
          <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 p-3.5 rounded-xl mb-6 text-sm flex items-start space-x-2">
            <ShieldAlert size={18} className="text-yellow-600 flex-shrink-0 mt-0.5" />
            <span>Suspicious login activity detected. Please verify your identity if requested.</span>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 p-3.5 rounded-xl mb-6 text-sm flex items-start space-x-2">
            <AlertCircle size={18} className="text-red-500 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5" autoComplete="off">
          {/* Email */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2">Email Address</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                <Mail className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="email"
                required
                autoComplete="off"
                className="pl-10 w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm transition-all"
                placeholder="you@example.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
              />
            </div>
          </div>

          {/* Password */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2">Password</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                <Lock className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="password"
                required
                autoComplete="new-password"
                className="pl-10 w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm transition-all"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || isLocked}
            className={`w-full text-white font-semibold py-3 rounded-xl transition-colors shadow-md text-sm ${
              isLocked ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 hover:shadow-lg disabled:opacity-50'
            }`}
          >
            {loading ? 'Signing in...' : isLocked ? 'Account Locked' : 'Sign In'}
          </button>
        </form>

        {/* Or divider */}
        <div className="mt-6">
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-gray-500">Or continue with</span>
            </div>
          </div>
          <div className="mt-6">
            <GoogleAuthButton
              onClick={() => googleLogin()}
              disabled={loading || isLocked}
              label="Sign in with Google"
            />
          </div>
        </div>

        <div className="mt-6 flex flex-col items-center">
          <p className="text-center text-sm text-gray-600">
            Don't have an account?{' '}
            <Link to="/register" className="text-blue-600 hover:underline font-semibold">Create one</Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
