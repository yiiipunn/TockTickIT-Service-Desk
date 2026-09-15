import { FormEvent, useRef, useState } from "react";
import { ApiError, AuthenticatedUser, login } from "./api";

interface LoginScreenProps {
  onAuthenticated: (user: AuthenticatedUser) => void;
  initialFailure?: string;
}

export default function LoginScreen({
  onAuthenticated,
  initialFailure = "",
}: LoginScreenProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState(initialFailure);
  const passwordRef = useRef<HTMLInputElement>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    const normalizedEmail = email.trim().toLowerCase();
    const errors: Record<string, string> = {};
    if (
      !normalizedEmail ||
      normalizedEmail.length > 254 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)
    ) {
      errors.email = "Enter a valid email address.";
    }
    if (!password) errors.password = "Enter your password.";
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setFailure("");
      return;
    }

    setSubmitting(true);
    setFieldErrors({});
    setFailure("");
    try {
      onAuthenticated(await login(normalizedEmail, password));
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.code === "INVALID_CREDENTIALS") {
          setFailure("The email or password is incorrect.");
        } else if (error.code === "ACCOUNT_INACTIVE") {
          setFailure("This account cannot sign in. Contact an administrator.");
        } else if (error.code === "LOGIN_THROTTLED") {
          setFailure("Too many sign-in attempts. Try again later.");
        } else {
          setFailure("Unable to sign in right now. Please try again.");
        }
      } else {
        setFailure("Unable to sign in right now. Please try again.");
      }
      setPassword("");
      requestAnimationFrame(() => passwordRef.current?.focus());
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="login-page">
      <section className="card login-card shadow-sm" aria-labelledby="login-title">
        <div className="card-body p-4 p-md-5">
          <div className="login-mark" aria-hidden="true">T</div>
          <h1 id="login-title" className="h2 text-center mb-2">Sign in to TokTickIT</h1>
          <p className="text-muted text-center mb-4">
            Use your service desk account to continue.
          </p>

          {failure && <div className="alert alert-danger" role="alert">{failure}</div>}

          <form onSubmit={handleSubmit} noValidate>
            <div className="mb-3">
              <label className="form-label fw-semibold" htmlFor="login-email">Email</label>
              <input
                id="login-email"
                className={`form-control ${fieldErrors.email ? "is-invalid" : ""}`}
                type="email"
                autoComplete="username"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                aria-describedby={fieldErrors.email ? "login-email-error" : undefined}
                disabled={submitting}
                required
              />
              {fieldErrors.email && (
                <div id="login-email-error" className="invalid-feedback">{fieldErrors.email}</div>
              )}
            </div>

            <div className="mb-4">
              <label className="form-label fw-semibold" htmlFor="login-password">Password</label>
              <div className="input-group">
                <input
                  ref={passwordRef}
                  id="login-password"
                  className={`form-control ${fieldErrors.password ? "is-invalid" : ""}`}
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  aria-describedby={fieldErrors.password ? "login-password-error" : undefined}
                  disabled={submitting}
                  required
                />
                <button
                  type="button"
                  className="btn btn-outline-secondary"
                  onClick={() => setShowPassword((value) => !value)}
                  disabled={submitting}
                  aria-label={`${showPassword ? "Hide" : "Show"} password`}
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
                {fieldErrors.password && (
                  <div id="login-password-error" className="invalid-feedback d-block">
                    {fieldErrors.password}
                  </div>
                )}
              </div>
            </div>

            <button type="submit" className="btn btn-success btn-lg w-100" disabled={submitting}>
              {submitting ? "Signing in…" : "Sign in"}
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}
