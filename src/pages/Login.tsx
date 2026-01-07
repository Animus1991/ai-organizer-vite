// src/pages/Login.tsx
import React, { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { getErrorMessage } from "../lib/errorHandler";
import { validateEmail, validatePassword, validateForm } from "../lib/validation";

type LocationState = { from?: { pathname?: string } };

export default function Login() {
  const { login, register, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const state = (location.state as LocationState | null) ?? null;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});
  const [touched, setTouched] = useState<{ email: boolean; password: boolean }>({ email: false, password: false });

  // Real-time validation
  const emailError = touched.email ? validateEmail(email) : null;
  const passwordError = touched.password ? validatePassword(password, isSignUp) : null;
  const isFormValid = !emailError && !passwordError && email.trim() && password.trim();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setTouched({ email: true, password: true });

    // Validate form
    const emailErr = validateEmail(email);
    const passwordErr = validatePassword(password, isSignUp);
    
    if (emailErr || passwordErr) {
      setFieldErrors({
        email: emailErr || undefined,
        password: passwordErr || undefined
      });
      return;
    }

    setFieldErrors({});

    try {
      if (isSignUp) {
        // Register new user
        await register(email.trim(), password);
        // After successful registration, user is automatically logged in
        const target = state?.from?.pathname ?? "/";
        navigate(target, { replace: true });
      } else {
        // Login existing user
        // Στο backend σου (Swagger) το /api/auth/login θέλει OAuth2 "username" + "password".
        // Εδώ περνάμε email ως username.
        await login(email.trim(), password);
        const target = state?.from?.pathname ?? "/";
        navigate(target, { replace: true });
      }
    } catch (err: any) {
      // Use getErrorMessage to handle both axios errors and AppError
      const msg = getErrorMessage(err) || (isSignUp ? "Registration failed" : "Invalid credentials");
      setError(msg);
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4" style={{ display: "grid", placeItems: "center", minHeight: "100vh" }}>
      <div className="w-full max-w-md">
        <form
          onSubmit={onSubmit}
          className="bg-surface border border-border rounded-xl shadow-lg p-8"
          style={{
            width: 320,
            padding: 24,
            border: "1px solid rgba(255,255,255,0.18)",
            borderRadius: 10,
            background: "rgba(0,0,0,0.20)",
          }}
        >
          <div className="text-center mb-8">
            <div className="w-12 h-12 bg-primary rounded-lg flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-primary mb-2">
              {isSignUp ? "Create Account" : "Welcome Back"}
            </h2>
            <p className="text-secondary">
              {isSignUp ? "Sign up for a new account" : "Sign in to your account"}
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-secondary mb-2" style={{ display: "block", marginBottom: 6 }}>
                Email <span style={{ color: "#ef4444" }}>*</span>
              </label>
              <input
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (touched.email) {
                    const err = validateEmail(e.target.value);
                    setFieldErrors(prev => ({ ...prev, email: err || undefined }));
                  }
                }}
                onBlur={() => {
                  setTouched(prev => ({ ...prev, email: true }));
                  const err = validateEmail(email);
                  setFieldErrors(prev => ({ ...prev, email: err || undefined }));
                }}
                type="email"
                autoComplete="email"
                placeholder="user@example.com"
                className="w-full px-4 py-3 bg-surface-elevated border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-colors"
                style={{
                  width: "100%",
                  marginBottom: 4,
                  padding: 8,
                  borderColor: emailError ? "rgba(239, 68, 68, 0.5)" : "rgba(255, 255, 255, 0.1)",
                }}
              />
              {emailError && (
                <p style={{ fontSize: 12, color: "#ef4444", marginTop: 4, marginBottom: 8 }}>
                  {emailError}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-secondary mb-2" style={{ display: "block", marginBottom: 6 }}>
                Password <span style={{ color: "#ef4444" }}>*</span>
              </label>
              <input
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (touched.password) {
                    const err = validatePassword(e.target.value, isSignUp);
                    setFieldErrors(prev => ({ ...prev, password: err || undefined }));
                  }
                }}
                onBlur={() => {
                  setTouched(prev => ({ ...prev, password: true }));
                  const err = validatePassword(password, isSignUp);
                  setFieldErrors(prev => ({ ...prev, password: err || undefined }));
                }}
                type="password"
                autoComplete="current-password"
                placeholder="••••••••"
                className="w-full px-4 py-3 bg-surface-elevated border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-colors"
                style={{
                  width: "100%",
                  marginBottom: 4,
                  padding: 8,
                  borderColor: passwordError ? "rgba(239, 68, 68, 0.5)" : "rgba(255, 255, 255, 0.1)",
                }}
              />
              {passwordError && (
                <p style={{ fontSize: 12, color: "#ef4444", marginTop: 4, marginBottom: 8 }}>
                  {passwordError}
                </p>
              )}
              {isSignUp && !passwordError && password.length > 0 && (
                <p style={{ fontSize: 11, color: "rgba(255, 255, 255, 0.5)", marginTop: 4, marginBottom: 8 }}>
                  Password must be at least 6 characters
                </p>
              )}
            </div>
          </div>

          <button
            disabled={loading || !isFormValid}
            type="submit"
            className={`w-full py-3 px-4 rounded-lg font-medium transition-all duration-200 flex items-center justify-center gap-2 ${
              loading || !isFormValid
                ? "bg-gray-600 text-gray-400 cursor-not-allowed"
                : "bg-primary text-white hover:bg-primary-hover transform hover:translate-y-[-1px] shadow-md"
            }`}
            style={{
              width: "100%",
              padding: 10,
              cursor: loading || !isFormValid ? "not-allowed" : "pointer",
              opacity: loading || !isFormValid ? 0.7 : 1,
            }}
          >
            {loading ? (
              <>
                <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                {isSignUp ? "Creating account..." : "Signing in..."}
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                </svg>
                {isSignUp ? "Sign up" : "Sign in"}
              </>
            )}
          </button>

          <div style={{ marginTop: 16, textAlign: "center", fontSize: 14, opacity: 0.8 }}>
            {isSignUp ? (
              <>
                Already have an account?{" "}
                <button
                  type="button"
                  onClick={() => {
                    setIsSignUp(false);
                    setError(null);
                  }}
                  style={{
                    background: "none",
                    border: "none",
                    color: "#72ffbf",
                    cursor: "pointer",
                    textDecoration: "underline",
                  }}
                >
                  Sign in
                </button>
              </>
            ) : (
              <>
                Don't have an account?{" "}
                <button
                  type="button"
                  onClick={() => {
                    setIsSignUp(true);
                    setError(null);
                  }}
                  style={{
                    background: "none",
                    border: "none",
                    color: "#72ffbf",
                    cursor: "pointer",
                    textDecoration: "underline",
                  }}
                >
                  Sign up
                </button>
              </>
            )}
          </div>

          {error && (
            <div className="mt-4 p-3 bg-red-900/20 border border-red-800 rounded-lg text-red-400 text-sm" style={{ marginTop: 12, color: "tomato" }}>
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {error}
              </div>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
