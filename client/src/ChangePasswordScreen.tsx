import { FormEvent, useRef, useState } from "react";
import { ApiError, AuthenticatedUser, changePassword } from "./api";

interface ChangePasswordScreenProps {
  mandatory: boolean;
  onPasswordChanged: (user: AuthenticatedUser) => void;
  onSessionExpired: () => void;
  onCancel?: () => void;
}

function validate(
  currentPassword: string,
  newPassword: string,
  confirmPassword: string,
) {
  const fields: Record<string, string> = {};
  if (!currentPassword || currentPassword.length > 128) {
    fields.currentPassword = "Enter your current password.";
  }
  if (!newPassword) {
    fields.newPassword = "Enter a new password.";
  } else if (newPassword.length < 12 || newPassword.length > 128) {
    fields.newPassword = "Password must contain 12 to 128 characters.";
  } else if (/^\s+$/.test(newPassword)) {
    fields.newPassword = "Password cannot contain only whitespace.";
  } else if (currentPassword && newPassword === currentPassword) {
    fields.newPassword = "New password must differ from your current password.";
  }
  if (!confirmPassword) {
    fields.confirmPassword = "Confirm your new password.";
  } else if (confirmPassword !== newPassword) {
    fields.confirmPassword = "Passwords do not match.";
  }
  return fields;
}

export default function ChangePasswordScreen({
  mandatory,
  onPasswordChanged,
  onSessionExpired,
  onCancel,
}: ChangePasswordScreenProps) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPasswords, setShowPasswords] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState("");
  const [success, setSuccess] = useState("");
  const currentPasswordRef = useRef<HTMLInputElement>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    const errors = validate(currentPassword, newPassword, confirmPassword);
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setFailure("");
      setSuccess("");
      return;
    }

    setSubmitting(true);
    setFieldErrors({});
    setFailure("");
    setSuccess("");
    try {
      const user = await changePassword(
        currentPassword,
        newPassword,
        confirmPassword,
      );
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setSuccess("Password changed successfully. Continuing…");
      window.setTimeout(() => onPasswordChanged(user), 300);
    } catch (error) {
      if (error instanceof ApiError && error.code === "AUTH_REQUIRED") {
        onSessionExpired();
        return;
      }
      if (error instanceof ApiError && error.fields) {
        setFieldErrors(error.fields);
      }
      setFailure(
        error instanceof ApiError && error.code === "INVALID_CREDENTIALS"
          ? "The current password is incorrect."
          : "Unable to change your password right now. Please try again.",
      );
      setCurrentPassword("");
      requestAnimationFrame(() => currentPasswordRef.current?.focus());
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="password-change-page">
      <section className="card password-change-card shadow-sm" aria-labelledby="change-password-title">
        <div className="card-body p-4 p-md-5">
          <div className="login-mark" aria-hidden="true">T</div>
          <h1 id="change-password-title" className="h2 text-center mb-2">
            {mandatory ? "Password change required" : "Change Password"}
          </h1>
          <p className="text-muted text-center mb-2">
            {mandatory
              ? "Change your initial password before using TokTickIT."
              : "Replace your current TokTickIT password."}
          </p>
          <p id="password-policy" className="small text-muted text-center mb-4">
            Your new password must contain 12 to 128 characters, cannot contain
            only whitespace, and must differ from your current password.
          </p>

          {failure && <div className="alert alert-danger" role="alert">{failure}</div>}
          {success && <div className="alert alert-success" role="status">{success}</div>}

          <form onSubmit={handleSubmit} noValidate>
            <div className="mb-3">
              <label className="form-label fw-semibold" htmlFor="current-password">
                Current password
              </label>
              <input
                ref={currentPasswordRef}
                id="current-password"
                className={`form-control ${fieldErrors.currentPassword ? "is-invalid" : ""}`}
                type={showPasswords ? "text" : "password"}
                autoComplete="current-password"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                aria-describedby={fieldErrors.currentPassword ? "current-password-error" : undefined}
                disabled={submitting || Boolean(success)}
                autoFocus
              />
              {fieldErrors.currentPassword && (
                <div id="current-password-error" className="invalid-feedback">
                  {fieldErrors.currentPassword}
                </div>
              )}
            </div>

            <div className="mb-3">
              <label className="form-label fw-semibold" htmlFor="new-password">
                New password
              </label>
              <input
                id="new-password"
                className={`form-control ${fieldErrors.newPassword ? "is-invalid" : ""}`}
                type={showPasswords ? "text" : "password"}
                autoComplete="new-password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                aria-describedby={fieldErrors.newPassword ? "new-password-error password-policy" : "password-policy"}
                disabled={submitting || Boolean(success)}
              />
              {fieldErrors.newPassword && (
                <div id="new-password-error" className="invalid-feedback">
                  {fieldErrors.newPassword}
                </div>
              )}
            </div>

            <div className="mb-3">
              <label className="form-label fw-semibold" htmlFor="confirm-password">
                Confirm new password
              </label>
              <input
                id="confirm-password"
                className={`form-control ${fieldErrors.confirmPassword ? "is-invalid" : ""}`}
                type={showPasswords ? "text" : "password"}
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                aria-describedby={fieldErrors.confirmPassword ? "confirm-password-error" : undefined}
                disabled={submitting || Boolean(success)}
              />
              {fieldErrors.confirmPassword && (
                <div id="confirm-password-error" className="invalid-feedback">
                  {fieldErrors.confirmPassword}
                </div>
              )}
            </div>

            <div className="form-check mb-4">
              <input
                id="show-change-passwords"
                className="form-check-input"
                type="checkbox"
                checked={showPasswords}
                onChange={(event) => setShowPasswords(event.target.checked)}
                disabled={submitting || Boolean(success)}
              />
              <label className="form-check-label" htmlFor="show-change-passwords">
                Show passwords
              </label>
            </div>

            <div className="password-change-actions d-flex gap-2">
              {!mandatory && onCancel && (
                <button
                  type="button"
                  className="btn btn-outline-secondary flex-fill"
                  onClick={onCancel}
                  disabled={submitting || Boolean(success)}
                >
                  Cancel
                </button>
              )}
              <button
                type="submit"
                className="btn btn-success flex-fill"
                disabled={submitting || Boolean(success)}
              >
                {submitting ? "Changing Password…" : "Change Password"}
              </button>
            </div>
          </form>
        </div>
      </section>
    </main>
  );
}
