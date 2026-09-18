import { FormEvent, useEffect, useState } from "react";
import {
  ApiError,
  AuthenticatedUser,
  createAdminUser,
  CreateManagedUserInput,
  getAdminUsers,
  ManagedUser,
  setAdminInitialPassword,
  updateAdminUser,
  UpdateManagedUserInput,
  UserRole,
} from "./api";

type Screen = "list" | "create" | "edit" | "reset";
type LoadState = "loading" | "ready" | "error" | "forbidden";
type SaveState = "idle" | "saving";

const roles: Array<{ value: UserRole; label: string }> = [
  { value: "REQUESTER", label: "Requester" },
  { value: "IT_STAFF", label: "IT Staff" },
  { value: "ADMINISTRATOR", label: "Administrator" },
];

function roleLabel(role: UserRole) {
  return roles.find((option) => option.value === role)?.label ?? role;
}

function emptyForm(): CreateManagedUserInput {
  return { name: "", email: "", role: "REQUESTER", isActive: true, initialPassword: "" };
}

function editableForm(user: ManagedUser): UpdateManagedUserInput {
  return { name: user.name, email: user.email, role: user.role, isActive: user.isActive };
}

function apiMessage(error: unknown, fallback: string) {
  if (!(error instanceof ApiError)) return fallback;
  if (error.status === 403) return "You do not have access to User Management.";
  if (error.code === "DUPLICATE_EMAIL") return "An account already uses that email address.";
  if (error.code === "SELF_DEACTIVATION") return "You cannot deactivate your own Administrator account.";
  if (error.code === "LAST_ACTIVE_ADMIN") return "At least one active Administrator must remain.";
  return fallback;
}

function FieldError({ id, message }: { id: string; message?: string }) {
  return message ? <div id={id} className="text-danger small mt-1" role="alert">{message}</div> : null;
}

function UserForm({
  mode,
  currentUser,
  initial,
  saving,
  fields,
  failure,
  targetUserId,
  onSetInitialPassword,
  onCancel,
  onSubmit,
}: {
  mode: "create" | "edit";
  currentUser: AuthenticatedUser;
  initial: CreateManagedUserInput | UpdateManagedUserInput;
  saving: boolean;
  fields: Record<string, string>;
  failure: string;
  targetUserId?: number;
  onSetInitialPassword?: () => void;
  onCancel: () => void;
  onSubmit: (input: CreateManagedUserInput | UpdateManagedUserInput) => void;
}) {
  const [form, setForm] = useState<CreateManagedUserInput | UpdateManagedUserInput>(initial);
  const [initialPasswordConfirmation, setInitialPasswordConfirmation] = useState("");
  const [confirmationError, setConfirmationError] = useState("");
  const create = mode === "create";
  const title = create ? "Create User" : "Edit User";

  useEffect(() => { setForm(initial); setInitialPasswordConfirmation(""); setConfirmationError(""); }, [initial]);

  function update<K extends keyof (CreateManagedUserInput & UpdateManagedUserInput)>(key: K, value: (CreateManagedUserInput & UpdateManagedUserInput)[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (create && initialPasswordConfirmation !== (form as CreateManagedUserInput).initialPassword) {
      setConfirmationError("Initial passwords do not match.");
      return;
    }
    onSubmit(form);
  }

  const nameError = fields.name;
  const emailError = fields.email;
  const roleError = fields.role;
  const activeError = fields.isActive;
  const passwordError = fields.initialPassword;

  return <section className="card shadow-sm">
    <div className="card-body p-3 p-md-4">
      <div className="d-flex flex-wrap justify-content-between align-items-start gap-2 mb-4">
        <div>
          <h1 className="h3 mb-1">{title}</h1>
          <p className="text-muted mb-0">{create ? "Create an account with one role and an initial password." : "Update basic account details and activation state."}</p>
        </div>
      </div>
      <form onSubmit={submit} noValidate>
        {failure && <div className="alert alert-danger" role="alert">{failure}</div>}
        {fields.body && <div className="alert alert-danger" role="alert">{fields.body}</div>}
        <div className="row g-3">
          <div className="col-md-6">
            <label className="form-label fw-semibold" htmlFor="managed-user-name">Name <span className="text-danger">*</span></label>
            <input id="managed-user-name" className="form-control" value={form.name} disabled={saving}
              aria-invalid={nameError ? true : undefined} aria-describedby={nameError ? "managed-user-name-error" : undefined}
              onChange={(event) => update("name", event.target.value)} />
            <FieldError id="managed-user-name-error" message={nameError} />
          </div>
          <div className="col-md-6">
            <label className="form-label fw-semibold" htmlFor="managed-user-email">Email <span className="text-danger">*</span></label>
            <input id="managed-user-email" className="form-control" type="email" value={form.email} disabled={saving}
              aria-invalid={emailError ? true : undefined} aria-describedby={emailError ? "managed-user-email-error" : undefined}
              onChange={(event) => update("email", event.target.value)} />
            <FieldError id="managed-user-email-error" message={emailError} />
          </div>
          <div className="col-md-6">
            <label className="form-label fw-semibold" htmlFor="managed-user-role">Role <span className="text-danger">*</span></label>
            <select id="managed-user-role" className="form-select" value={form.role} disabled={saving}
              aria-invalid={roleError ? true : undefined} aria-describedby={roleError ? "managed-user-role-error" : undefined}
              onChange={(event) => update("role", event.target.value as UserRole)}>
              {roles.map((role) => <option key={role.value} value={role.value}>{role.label}</option>)}
            </select>
            <FieldError id="managed-user-role-error" message={roleError} />
          </div>
          <div className="col-md-6">
            <label className="form-label fw-semibold" htmlFor="managed-user-active">Account Status <span className="text-danger">*</span></label>
            <select id="managed-user-active" className="form-select" value={String(form.isActive)} disabled={saving || (!create && currentUser.id === targetUserId)}
              aria-invalid={activeError ? true : undefined} aria-describedby={activeError ? "managed-user-active-error" : undefined}
              onChange={(event) => update("isActive", event.target.value === "true")}>
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </select>
            {!create && currentUser.id === targetUserId && <div className="form-text">You cannot deactivate your own Administrator account.</div>}
            <FieldError id="managed-user-active-error" message={activeError} />
          </div>
          {create && <div className="col-12">
            <label className="form-label fw-semibold" htmlFor="managed-user-initial-password">Initial Password <span className="text-danger">*</span></label>
            <input id="managed-user-initial-password" className="form-control" type="password" value={(form as CreateManagedUserInput).initialPassword} disabled={saving}
              aria-invalid={passwordError ? true : undefined} aria-describedby={passwordError ? "managed-user-password-error" : "managed-user-password-help"}
              onChange={(event) => update("initialPassword", event.target.value)} />
            <div id="managed-user-password-help" className="form-text">12 to 128 characters. The user must change this password after first sign-in.</div>
            <FieldError id="managed-user-password-error" message={passwordError} />
          </div>}
          {create && <div className="col-12">
            <label className="form-label fw-semibold" htmlFor="managed-user-initial-password-confirmation">Confirm Initial Password <span className="text-danger">*</span></label>
            <input id="managed-user-initial-password-confirmation" className="form-control" type="password" value={initialPasswordConfirmation} disabled={saving}
              aria-invalid={confirmationError ? true : undefined} aria-describedby={confirmationError ? "managed-user-password-confirmation-error" : undefined}
              onChange={(event) => { setInitialPasswordConfirmation(event.target.value); setConfirmationError(""); }} />
            <FieldError id="managed-user-password-confirmation-error" message={confirmationError} />
          </div>}
        </div>
        <div className="d-flex flex-wrap gap-2 mt-4">
          <button type="button" className="btn btn-outline-secondary" onClick={onCancel} disabled={saving}>Cancel</button>
          <button type="submit" className="btn btn-success" disabled={saving}>{saving ? (create ? "Creating User..." : "Saving Changes...") : (create ? "Create User" : "Save Changes")}</button>
          {!create && onSetInitialPassword && <button type="button" className="btn btn-outline-success" onClick={onSetInitialPassword} disabled={saving}>Set New Initial Password</button>}
        </div>
      </form>
    </div>
  </section>;
}

export default function UserManagement({ currentUser }: { currentUser: AuthenticatedUser }) {
  const [state, setState] = useState<LoadState>("loading");
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [search, setSearch] = useState("");
  const [role, setRole] = useState<UserRole | "">("");
  const [screen, setScreen] = useState<Screen>("list");
  const [selected, setSelected] = useState<ManagedUser | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState("");
  const [success, setSuccess] = useState("");
  const [saving, setSaving] = useState<SaveState>("idle");
  const [createForm, setCreateForm] = useState<CreateManagedUserInput>(emptyForm());
  const [editForm, setEditForm] = useState<UpdateManagedUserInput | null>(null);
  const [resetPassword, setResetPassword] = useState("");

  async function load() {
    setState("loading");
    setFailure("");
    try {
      setUsers(await getAdminUsers({ search, role }));
      setState("ready");
    } catch (error) {
      setUsers([]);
      setState(error instanceof ApiError && error.status === 403 ? "forbidden" : "error");
    }
  }

  useEffect(() => { void load(); }, []);

  function backToList(message = "") {
    setScreen("list"); setSelected(null); setEditForm(null); setFields({}); setFailure(""); setSuccess(message);
  }

  async function submitCreate(input: CreateManagedUserInput | UpdateManagedUserInput) {
    setSaving("saving"); setFields({}); setFailure("");
    try {
      await createAdminUser(input as CreateManagedUserInput);
      setCreateForm(emptyForm());
      backToList("User created. They must change their initial password when they sign in.");
      await load();
    } catch (error) {
      if (error instanceof ApiError && error.fields) setFields(error.fields);
      else setFailure(apiMessage(error, "Unable to create the User right now."));
    } finally { setSaving("idle"); }
  }

  async function submitEdit(input: CreateManagedUserInput | UpdateManagedUserInput) {
    if (!selected) return;
    setSaving("saving"); setFields({}); setFailure("");
    try {
      await updateAdminUser(selected.id, input as UpdateManagedUserInput);
      backToList("User changes saved.");
      await load();
    } catch (error) {
      if (error instanceof ApiError && error.fields) setFields(error.fields);
      else setFailure(apiMessage(error, "Unable to update the User right now."));
    } finally { setSaving("idle"); }
  }

  async function submitReset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    setSaving("saving"); setFields({}); setFailure("");
    try {
      await setAdminInitialPassword(selected.id, resetPassword);
      setResetPassword("");
      backToList("New initial password set. Existing sessions ended and the user must change it at next sign-in.");
      await load();
    } catch (error) {
      if (error instanceof ApiError && error.fields) setFields(error.fields);
      else setFailure(apiMessage(error, "Unable to set the initial password right now."));
    } finally { setSaving("idle"); }
  }

  function applyFilters(event: FormEvent<HTMLFormElement>) { event.preventDefault(); void load(); }
  function clearFilters() { setSearch(""); setRole(""); setTimeout(() => void load(), 0); }

  if (screen === "create") return <UserForm mode="create" currentUser={currentUser} initial={createForm} saving={saving === "saving"} fields={fields} failure={failure}
    onCancel={() => backToList()} onSubmit={submitCreate} />;
  if (screen === "edit" && selected && editForm) return <UserForm mode="edit" currentUser={currentUser} initial={editForm} saving={saving === "saving"} fields={fields} failure={failure} targetUserId={selected.id}
    onSetInitialPassword={() => { setFields({}); setFailure(""); setScreen("reset"); }} onCancel={() => backToList()} onSubmit={submitEdit} />;
  if (screen === "reset" && selected) return <section className="card shadow-sm"><div className="card-body p-3 p-md-4">
    <h1 className="h3 mb-1">Set New Initial Password</h1>
    <p className="text-muted mb-4">Set a new initial password for {selected.name}. This ends existing sessions and requires a password change at next sign-in.</p>
    <form onSubmit={submitReset} noValidate>
      {failure && <div className="alert alert-danger" role="alert">{failure}</div>}
      <label className="form-label fw-semibold" htmlFor="reset-initial-password">New Initial Password</label>
      <input id="reset-initial-password" className="form-control" type="password" value={resetPassword} disabled={saving === "saving"}
        aria-invalid={fields.initialPassword ? true : undefined} aria-describedby={fields.initialPassword ? "reset-password-error" : "reset-password-help"}
        onChange={(event) => setResetPassword(event.target.value)} />
      <div id="reset-password-help" className="form-text">12 to 128 characters. This password is never displayed or stored as plain text.</div>
      <FieldError id="reset-password-error" message={fields.initialPassword} />
      <div className="d-flex flex-wrap gap-2 mt-4"><button type="button" className="btn btn-outline-secondary" onClick={() => backToList()} disabled={saving === "saving"}>Cancel</button>
        <button type="submit" className="btn btn-success" disabled={saving === "saving"}>{saving === "saving" ? "Setting Initial Password..." : "Set Initial Password"}</button></div>
    </form>
  </div></section>;

  return <section className="card shadow-sm"><div className="card-body p-3 p-md-4">
    <div className="d-flex flex-wrap justify-content-between align-items-start gap-3 mb-4"><div><h1 className="h3 mb-1">User Management</h1><p className="text-muted mb-0">Manage user accounts, roles, activation, and initial passwords.</p></div>
      <button type="button" className="btn btn-success" onClick={() => { setCreateForm(emptyForm()); setFields({}); setFailure(""); setScreen("create"); }}>Create User</button></div>
    {success && <div className="alert alert-success" role="status">{success}</div>}
    <form className="row g-3 align-items-end mb-4" onSubmit={applyFilters}>
      <div className="col-md"><label className="form-label fw-semibold" htmlFor="user-search">Search</label><input id="user-search" className="form-control" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Name or email" /></div>
      <div className="col-md-4"><label className="form-label fw-semibold" htmlFor="user-role-filter">Role</label><select id="user-role-filter" className="form-select" value={role} onChange={(event) => setRole(event.target.value as UserRole | "")}><option value="">All roles</option>{roles.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></div>
      <div className="col-md-auto d-flex flex-wrap gap-2"><button type="submit" className="btn btn-outline-success">Search</button>{(search || role) && <button type="button" className="btn btn-outline-secondary" onClick={clearFilters}>Clear</button>}</div>
    </form>
    {state === "loading" && <p className="text-muted" role="status">Loading Users...</p>}
    {state === "forbidden" && <div className="alert alert-danger" role="alert">You do not have access to User Management.</div>}
    {state === "error" && <div className="alert alert-danger" role="alert">Unable to load Users right now. <button type="button" className="btn btn-link p-0 align-baseline" onClick={() => void load()}>Retry</button></div>}
    {state === "ready" && users.length === 0 && <div className="alert alert-light border mb-0"><h2 className="h5">{search || role ? "No matching users" : "No users found"}</h2><p className="mb-0">{search || role ? "Try different search or role filters." : "Create a User to begin managing accounts."}</p></div>}
    {state === "ready" && users.length > 0 && <>
      <div className="table-responsive d-none d-md-block"><table className="table align-middle mb-0"><thead><tr><th scope="col">Name</th><th scope="col">Email</th><th scope="col">Role</th><th scope="col">Status</th><th scope="col"><span className="visually-hidden">Actions</span></th></tr></thead><tbody>{users.map((user) => <tr key={user.id}><td className="text-break fw-semibold">{user.name}</td><td className="text-break">{user.email}</td><td><span className="badge text-bg-light border text-dark">{roleLabel(user.role)}</span></td><td><span className={`badge ${user.isActive ? "text-bg-success" : "text-bg-secondary"}`}>{user.isActive ? "Active" : "Inactive"}</span></td><td className="text-end"><button type="button" className="btn btn-sm btn-outline-success" onClick={() => { setSelected(user); setEditForm(editableForm(user)); setFields({}); setFailure(""); setScreen("edit"); }}>Edit {user.name}</button></td></tr>)}</tbody></table></div>
      <div className="d-grid gap-3 d-md-none">{users.map((user) => <article className="border rounded-3 p-3" key={user.id}><h2 className="h6 text-break">{user.name}</h2><p className="text-break mb-2">{user.email}</p><div className="d-flex flex-wrap gap-2 mb-3"><span className="badge text-bg-light border text-dark">{roleLabel(user.role)}</span><span className={`badge ${user.isActive ? "text-bg-success" : "text-bg-secondary"}`}>{user.isActive ? "Active" : "Inactive"}</span></div><button type="button" className="btn btn-outline-success w-100" onClick={() => { setSelected(user); setEditForm(editableForm(user)); setFields({}); setFailure(""); setScreen("edit"); }}>Edit {user.name}</button></article>)}</div>
    </>}
  </div></section>;
}
