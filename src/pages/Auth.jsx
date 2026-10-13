import { useState } from "react";
import { Link } from "../components/UI.jsx";
import Icon from "../components/Icon.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { request } from "../services/api.js";
function safeDestination(value) {
  return value?.startsWith("/") &&
    !value.startsWith("//") &&
    !value.includes("://")
    ? value
    : "/professors";
}
export default function Auth({ mode, params }) {
  const register = mode === "register",
    forgot = mode === "forgot-password",
    reset = mode === "reset-password";
  const {
    login,
    resetPassword,
    loading,
    error: connectionError,
    refreshSession,
    studentDomains,
    mailMode,
  } = useAuth();
  const [email, setEmail] = useState(params.get("email") || ""),
    [password, setPassword] = useState(""),
    [code, setCode] = useState("");
  const [agreed, setAgreed] = useState(false),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [error, setError] = useState(""),
    [errorCode, setErrorCode] = useState(""),
    [complete, setComplete] = useState(false);
  async function submit(e) {
    e.preventDefault();
    setError("");
    setErrorCode("");
    setMessage("");
    setBusy(true);
    try {
      if (register) {
        const result = await request("/auth/register", {
          method: "POST",
          body: { email, password, agreed },
        });
        setMessage(result.message);
        setComplete(true);
      } else if (forgot) {
        await request("/auth/forgot-password", {
          method: "POST",
          body: { email },
        });
        window.location.hash = `/reset-password?email=${encodeURIComponent(email)}`;
      } else if (reset) {
        const result = await resetPassword({ email, code, password });
        setMessage(result.message);
        setComplete(true);
      } else {
        const user = await login(email, password);
        window.location.hash = safeDestination(
          params.get("next") ||
            (user.role === "admin" ? "/admin" : "/professors"),
        );
      }
    } catch (failure) {
      setError(failure.message);
      setErrorCode(failure.code);
    } finally {
      setBusy(false);
    }
  }
  async function resend() {
    setError("");
    setBusy(true);
    try {
      const result = await request("/auth/forgot-password", {
        method: "POST",
        body: { email },
      });
      setMessage(result.message);
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  }
  const title =
    reset || forgot
      ? "Let’s get you back in."
      : register
        ? "Your campus perspective belongs here."
        : "Good to see you again.";
  return (
    <div className="container auth-page">
      <section className="auth-story">
        <div className="eyebrow">FOR THE PEOPLE BEHIND THE PERSPECTIVES</div>
        <h1>
          Your voice matters.
          <br />
          <span className="serif">Your name stays yours.</span>
        </h1>
        <p>
          Create an account with your student email and a password. Keep your
          account information separate from public perspectives.
        </p>
        <div className="auth-benefits">
          {[
            [
              "cap",
              "A campus community",
              "Registration is restricted to approved student email domains.",
            ],
            [
              "shield",
              "Private account information",
              "Your email is shown only in your own account interface.",
            ],
            [
              "book",
              "Better choices, together",
              "Explore professors and courses before your next semester.",
            ],
          ].map(([icon, name, text]) => (
            <div key={icon}>
              <span className="icon-tile">
                <Icon name={icon} size={22} />
              </span>
              <div>
                <strong>{name}</strong>
                <p>{text}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="auth-illustration" aria-hidden="true">
          <span>✳</span>
          <span>
            Learning is better
            <br />
            <i>when we share.</i>
          </span>
        </div>
      </section>
      <section className="panel auth-card">
        <div className="eyebrow">
          {reset || forgot
            ? "PASSWORD RECOVERY"
            : register
              ? "JOIN THE COMMUNITY"
              : "WELCOME BACK"}
        </div>
        <h2>{title}</h2>
        <p className="muted">
          {reset
            ? "If this account exists, a reset code has been sent. Enter it with your new password."
            : forgot
              ? "Enter your account email to request a reset code."
              : register
                ? `Register with an email from ${studentDomains.join(", ")}.`
                : "Log in with your email and password."}
        </p>
        {mailMode === "file" && (forgot || reset) && (
          <div className="auth-preview">
            <Icon name="info" size={16} />
            <span>
              Local development: emails are saved in this project’s private{" "}
              <code>.local/mail/</code> folder. Open the latest message for your
              address to get your code. No real email is sent in this mode.
            </span>
          </div>
        )}
        {connectionError && (
          <>
            <p className="form-error" role="alert">
              {connectionError}
            </p>
            <button
              type="button"
              className="button secondary"
              onClick={refreshSession}
            >
              Reconnect
            </button>
          </>
        )}
        {complete ? (
          <div className="auth-complete">
            <span className="success-icon">
              <Icon name="check" size={30} />
            </span>
            <h3>
              {register
                ? "Your account is ready."
                : "Your password has been changed."}
            </h3>
            <p>{message || "Your account is ready. Log in to continue."}</p>
            <Link
              to={`/login?email=${encodeURIComponent(email)}`}
              className="button primary"
            >
              Continue to login <Icon name="arrow" size={17} />
            </Link>
          </div>
        ) : (
          <form className="form-stack" onSubmit={submit}>
            <label>
              {register ? "Student email" : "Email"}
              <div className="input-with-icon">
                <Icon name="mail" size={18} />
                <input
                  aria-label={register ? "Student email" : "Email"}
                  type="email"
                  required
                  maxLength={254}
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={`you@${studentDomains[0]}`}
                />
              </div>
            </label>
            {reset && (
              <label>
                Six-digit reset code
                <input
                  aria-label="Reset code"
                  className="otp-input"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  required
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                  placeholder="000000"
                />
              </label>
            )}
            {!forgot && (
              <label>
                {reset ? "New password" : "Password"}
                <div className="input-with-icon">
                  <Icon name="lock" size={18} />
                  <input
                    aria-label={reset ? "New password" : "Password"}
                    type="password"
                    minLength={register || reset ? 12 : 1}
                    maxLength={128}
                    required
                    autoComplete={
                      register || reset ? "new-password" : "current-password"
                    }
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={
                      register || reset
                        ? "At least 12 characters"
                        : "Your account password"
                    }
                  />
                </div>
              </label>
            )}
            {register && (
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  required
                  checked={agreed}
                  onChange={(e) => setAgreed(e.target.checked)}
                />
                <span>
                  I agree to the{" "}
                  <Link to="/guidelines">community guidelines</Link> and{" "}
                  <Link to="/privacy">privacy information</Link>.
                </span>
              </label>
            )}
            {!register && !forgot && !reset && (
              <Link to="/forgot-password" className="text-link forgot-link">
                Forgot your password?
              </Link>
            )}
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            {errorCode === "ACCOUNT_EXISTS" && (
              <Link
                className="text-link"
                to={`/login?email=${encodeURIComponent(email)}`}
              >
                Sign in to your existing account
              </Link>
            )}
            {message && (
              <p className="form-message" role="status">
                {message}
              </p>
            )}
            <button
              className="button primary full-width"
              disabled={busy || loading || Boolean(connectionError)}
              type="submit"
            >
              {busy
                ? "Please wait…"
                : reset
                  ? "Change password"
                  : forgot
                    ? "Send reset code"
                    : register
                      ? "Create account"
                      : "Log in"}
              <Icon name="arrow" size={18} />
            </button>
            {reset && (
              <button
                type="button"
                disabled={busy || loading || Boolean(connectionError)}
                className="text-link centered"
                onClick={resend}
              >
                Resend code
              </button>
            )}
          </form>
        )}
        <div className="auth-switch">
          {forgot || reset ? (
            <Link to="/login">← Back to login</Link>
          ) : register ? (
            <>
              Already part of the community? <Link to="/login">Log in</Link>
            </>
          ) : (
            <>
              New here? <Link to="/register">Create an account</Link>
            </>
          )}
        </div>
        <div className="auth-lock">
          <Icon name="lock" size={14} />
          Sessions use a private HttpOnly cookie.
        </div>
      </section>
    </div>
  );
}
