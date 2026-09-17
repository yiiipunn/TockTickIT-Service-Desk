import { FormEvent, useEffect, useId, useRef, useState } from "react";
import {
  ApiError,
  CommunicationEntry,
  getInternalNotes,
  getPublicComments,
  postInternalNote,
  postPublicComment,
} from "./api";

type CommunicationKind = "public" | "internal";
type LoadState = "loading" | "ready" | "error" | "forbidden";

function chronological(entries: CommunicationEntry[]) {
  return [...entries].sort((a, b) =>
    Date.parse(a.createdAt) - Date.parse(b.createdAt) || a.id - b.id);
}

export default function TicketCommunication({
  ticketId,
  kind,
  initialEntries,
  headingLevel = 2,
}: {
  ticketId: number;
  kind: CommunicationKind;
  initialEntries?: CommunicationEntry[];
  headingLevel?: 2 | 3;
}) {
  const inputId = useId();
  const postingRef = useRef(false);
  const [entries, setEntries] = useState<CommunicationEntry[]>([]);
  const [loadState, setLoadState] = useState<LoadState>(initialEntries ? "ready" : "loading");
  const [draft, setDraft] = useState("");
  const [validationError, setValidationError] = useState("");
  const [postError, setPostError] = useState("");
  const [success, setSuccess] = useState("");
  const [posting, setPosting] = useState(false);
  const internal = kind === "internal";
  const heading = internal ? "Internal Notes" : "Public Comments";
  const Heading = headingLevel === 3 ? "h3" : "h2";

  useEffect(() => {
    let active = true;
    setDraft("");
    setValidationError("");
    setPostError("");
    setSuccess("");
    if (initialEntries !== undefined) {
      setEntries(chronological(initialEntries));
      setLoadState("ready");
    } else {
      setEntries([]);
      setLoadState("loading");
      const load = internal ? getInternalNotes : getPublicComments;
      void load(ticketId).then((items) => {
        if (!active) return;
        setEntries(chronological(items));
        setLoadState("ready");
      }).catch((error: unknown) => {
        if (!active) return;
        setLoadState(error instanceof ApiError && error.status === 403 ? "forbidden" : "error");
      });
    }
    return () => { active = false; };
  }, [ticketId, kind, initialEntries]);

  async function retryLoad() {
    setLoadState("loading");
    try {
      const items = await (internal ? getInternalNotes : getPublicComments)(ticketId);
      setEntries(chronological(items));
      setLoadState("ready");
    } catch (error) {
      setLoadState(error instanceof ApiError && error.status === 403 ? "forbidden" : "error");
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loadState !== "ready" || postingRef.current) return;
    const content = draft.trim();
    if (content.length < 1 || content.length > 2000) {
      setValidationError("Enter 1 to 2000 characters of plain text.");
      setSuccess("");
      return;
    }
    postingRef.current = true;
    setPosting(true);
    setValidationError("");
    setPostError("");
    setSuccess("");
    try {
      const created = await (internal ? postInternalNote : postPublicComment)(ticketId, content);
      setEntries((current) => chronological([...current, created]));
      setDraft("");
      setSuccess(internal ? "Internal Note added successfully." : "Public Comment posted successfully.");
    } catch (error) {
      if (error instanceof ApiError && error.status === 400) {
        setValidationError(error.fields?.content || "Enter 1 to 2000 characters of plain text.");
      } else {
        setPostError(internal ? "Unable to add the Internal Note right now." : "Unable to post the Public Comment right now.");
      }
    } finally {
      postingRef.current = false;
      setPosting(false);
    }
  }

  return <section className={`card shadow-sm mt-4 ${internal ? "border-warning bg-warning-subtle" : "border-success-subtle bg-white"}`} aria-labelledby={`${inputId}-heading`}>
    <div className="card-body p-3 p-md-4">
      <div className="d-flex flex-wrap align-items-start justify-content-between gap-2 mb-2">
        <div>
          <Heading id={`${inputId}-heading`} className="h5 mb-1">{heading}</Heading>
          <p className="small mb-0">{internal ? "Private to IT Staff and Administrators" : "Visible to Requester and IT Staff"}</p>
        </div>
        <span className={`badge ${internal ? "text-bg-warning" : "text-bg-success"}`}>{internal ? "Internal" : "Public"}</span>
      </div>

      {loadState === "loading" && <p className="text-muted mt-3" role="status">Loading {heading.toLowerCase()}...</p>}
      {loadState === "forbidden" && <div className="alert alert-danger mt-3" role="alert">You do not have access to this Ticket communication.</div>}
      {loadState === "error" && <div className="alert alert-danger mt-3" role="alert">
        <p className="mb-2">Unable to load {heading.toLowerCase()} right now.</p>
        <button className="btn btn-outline-danger" type="button" onClick={() => void retryLoad()}>Retry</button>
      </div>}
      {loadState === "ready" && <>
        {entries.length === 0 ? <p className="text-muted mt-3 mb-3">{internal ? "No internal notes yet." : "No comments yet."}</p> :
          <ol className="list-unstyled d-grid gap-2 mt-3 mb-4">
            {entries.map((entry) => <li key={entry.id}>
              <article className="border rounded-3 bg-white p-3">
                <div className="d-flex flex-wrap align-items-baseline gap-2 mb-2 small">
                  <strong className="text-break">{entry.author.name}</strong>
                  <span className="text-muted">{entry.author.role === "REQUESTER" ? "Requester" : entry.author.role === "IT_STAFF" ? "IT Staff" : "Administrator"}</span>
                  <time className="text-muted" dateTime={entry.createdAt}>{new Date(entry.createdAt).toLocaleString()}</time>
                </div>
                <p className="mb-0" style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{entry.content}</p>
              </article>
            </li>)}
          </ol>}
        <form onSubmit={(event) => void submit(event)} noValidate>
          <label className="form-label fw-semibold" htmlFor={`${inputId}-content`}>{internal ? "Internal Note" : "Public Comment"}</label>
          <textarea
            id={`${inputId}-content`}
            className="form-control"
            rows={3}
            value={draft}
            onChange={(event) => { setDraft(event.target.value); setValidationError(""); setPostError(""); }}
            disabled={posting}
            aria-invalid={validationError ? true : undefined}
            aria-describedby={validationError ? `${inputId}-error` : `${inputId}-help`}
          />
          <div id={`${inputId}-help`} className="form-text">Plain text, 1-2000 characters. {draft.length}/2000</div>
          {validationError && <div id={`${inputId}-error`} className="text-danger small mt-1" role="alert">{validationError}</div>}
          {postError && <div className="alert alert-danger mt-2 mb-0" role="alert">{postError}</div>}
          {success && <div className="alert alert-success mt-2 mb-0" role="status">{success}</div>}
          <button className={`btn mt-3 w-100 ${internal ? "btn-warning" : "btn-success"}`} type="submit" disabled={posting}>
            {posting ? internal ? "Adding Internal Note..." : "Posting Public Comment..." : internal ? "Add Internal Note" : "Post Public Comment"}
          </button>
        </form>
      </>}
    </div>
  </section>;
}
