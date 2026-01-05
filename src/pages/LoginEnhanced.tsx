// src/pages/LoginEnhanced.tsx
import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { useForm } from '../hooks/useForm';
import { Input } from '../components/ui/Input';
import { LoadingSpinner } from '../components/ui/Spinner';

type LocationState = { from?: { pathname?: string } };

export default function LoginEnhanced() {
  const { login, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const state = (location.state as LocationState | null) ?? null;

  const { values, isValid, getFieldProps, validateForm } = useForm(
    { email: '', password: '' },
    {
      email: {
        required: true,
        email: true
      },
      password: {
        required: true,
        minLength: 6
      }
    }
  );

  const [submitError, setSubmitError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError(null);

    if (!validateForm()) {
      return;
    }

    try {
      await login(values.email.trim(), values.password);
      const target = state?.from?.pathname ?? '/';
      navigate(target, { replace: true });
    } catch (err: any) {
      setSubmitError(err.message || 'Login failed');
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <form onSubmit={onSubmit} className="bg-surface border border-border rounded-xl shadow-lg p-8">
          <div className="text-center mb-8">
            <div className="w-12 h-12 bg-primary rounded-lg flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-primary mb-2">Welcome Back</h2>
            <p className="text-secondary">Sign in to your account</p>
          </div>

          <div className="space-y-4">
            <Input
              {...getFieldProps('email')}
              type="email"
              autoComplete="email"
              placeholder="user@example.com"
              label="Email"
              disabled={loading}
            />

            <Input
              {...getFieldProps('password')}
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              label="Password"
              disabled={loading}
            />
          </div>

          <button
            disabled={loading || !isValid}
            type="submit"
            className={`w-full py-3 px-4 rounded-lg font-medium transition-all duration-200 flex items-center justify-center gap-2 ${
              loading || !isValid
                ? "bg-gray-600 text-gray-400 cursor-not-allowed"
                : "bg-primary text-white hover:bg-primary-hover transform hover:translate-y-[-1px] shadow-md"
            }`}
          >
            {loading ? (
              <LoadingSpinner text="Signing in..." size="sm" />
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                </svg>
                Sign in
              </>
            )}
          </button>

          {submitError && (
            <div className="mt-4 p-3 bg-red-900/20 border border-red-800 rounded-lg text-red-400 text-sm">
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {submitError}
              </div>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
