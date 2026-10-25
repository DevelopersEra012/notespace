
import { useCallback, useEffect, useMemo, useState } from "react";
import DocumentEditor from "./DocumentEditor.jsx";

import {
  FileText,
  Plus,
  Search,
  LayoutGrid,
  List,
  Clock3,
  Users,
  Star,
  Trash2,
  MoreHorizontal,
  FolderOpen,
  Settings,
  HelpCircle,
  Sparkles,
  ChevronDown,
  FilePlus2,
  Share2,
  RefreshCw,
  RotateCcw,
} from "lucide-react";

import "./App.css";

const API_URL = (
  import.meta.env.VITE_API_URL || "http://localhost:5000"
).replace(/\/+$/, "");

const DEMO_USERS = [
  "demo@example.com",
  "collaborator@example.com",
];

async function apiRequest(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.message || `Request failed (${response.status})`);
  }

  return data;
}

function normalizeDocument(doc, userEmail) {
  const currentEmail = (userEmail || "").trim().toLowerCase();
  const ownerEmail = (doc.ownerEmail || "").trim().toLowerCase();
  const sharedWith = Array.isArray(doc.sharedWith) ? doc.sharedWith : [];
  const isOwner = ownerEmail === currentEmail;

  return {
    ...doc,
    id: doc._id || doc.id,
    shared: !isOwner,
    sharedByMe: isOwner && sharedWith.length > 0,
    collaboratorCount: sharedWith.length,
    accessRole: doc.accessRole || (isOwner ? "owner" : "viewer"),
    starred: Boolean(doc.isStarred ?? doc.starred),
    deleted: Boolean(doc.isTrashed ?? doc.deleted),
    updatedAt: doc.updatedAt || new Date().toISOString(),
  };
}

function App() {
  const [userEmail, setUserEmail] = useState(DEMO_USERS[0]);
  const [documents, setDocuments] = useState([]);
  const [activeTab, setActiveTab] = useState("All documents");
  const [search, setSearch] = useState("");
  const [view, setView] = useState("grid");
  const [activeDocumentId, setActiveDocumentId] = useState(null);
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadDocuments = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const result = await apiRequest(
        `/api/documents?userEmail=${encodeURIComponent(userEmail)}`
      );

      setDocuments(
        (result.documents || []).map((doc) =>
          normalizeDocument(doc, userEmail)
        )
      );
    } catch (err) {
      setError(err.message || "Unable to load documents.");
    } finally {
      setLoading(false);
    }
  }, [userEmail]);

  useEffect(() => {
    setActiveDocumentId(null);
    loadDocuments();
  }, [loadDocuments]);

  const filteredDocuments = useMemo(() => {
    return documents.filter((doc) => {
      const matchesSearch = (doc.title || "")
        .toLowerCase()
        .includes(search.toLowerCase());

      if (activeTab === "Shared with me") {
        return matchesSearch && doc.shared && !doc.deleted;
      }

      if (activeTab === "Starred") {
        return matchesSearch && doc.starred && !doc.deleted;
      }

      if (activeTab === "Trash") {
        return (
          matchesSearch &&
          doc.deleted &&
          doc.accessRole === "owner"
        );
      }

      return matchesSearch && !doc.deleted;
    });
  }, [documents, activeTab, search]);

  async function createDocument() {
    setNotice("");
    setError("");

    try {
      const result = await apiRequest("/api/documents", {
        method: "POST",
        body: JSON.stringify({
          title: "Untitled document",
          content: "",
          userEmail,
        }),
      });

      const doc = normalizeDocument(result.document, userEmail);
      setDocuments((previous) => [doc, ...previous]);
      setActiveDocumentId(doc.id);
    } catch (err) {
      setError(err.message || "Unable to create document.");
    }
  }

  function openDocument(doc) {
    if (doc.deleted) {
      setNotice("Restore this document before opening it.");
      return;
    }

    setActiveDocumentId(doc.id);
    setNotice("");
    setError("");
  }

  async function saveDocument(updatedDocument) {
    const result = await apiRequest(
      `/api/documents/${encodeURIComponent(updatedDocument.id)}`,
      {
        method: "PUT",
        body: JSON.stringify({
          title: updatedDocument.title,
          content: updatedDocument.content,
          userEmail,
        }),
      }
    );

    const saved = normalizeDocument(result.document, userEmail);

    setDocuments((previous) =>
      previous.map((doc) => (doc.id === saved.id ? saved : doc))
    );

    setActiveDocumentId(null);
    setNotice("Document saved successfully.");
    setError("");
  }

  async function shareDocument({ document, email, role }) {
    const currentEmail = userEmail.trim().toLowerCase();
    const recipientEmail = email.trim().toLowerCase();

    if (!recipientEmail) {
      throw new Error("Please enter a valid email address.");
    }

    if (
      (document.ownerEmail || "").trim().toLowerCase() !== currentEmail
    ) {
      throw new Error("Only the owner can share this document.");
    }

    const result = await apiRequest(
      `/api/documents/${encodeURIComponent(document.id)}/share`,
      {
        method: "POST",
        body: JSON.stringify({
          userEmail: currentEmail,
          email: recipientEmail,
          role,
        }),
      }
    );

    await loadDocuments();
    return result;
  }

  async function removeCollaborator({ document, email }) {
    const currentEmail = userEmail.trim().toLowerCase();

    if (
      (document.ownerEmail || "").trim().toLowerCase() !== currentEmail
    ) {
      throw new Error("Only the owner can remove collaborators.");
    }

    const result = await apiRequest(
      `/api/documents/${encodeURIComponent(document.id)}/share/${encodeURIComponent(email)}?userEmail=${encodeURIComponent(currentEmail)}`,
      { method: "DELETE" }
    );

    await loadDocuments();
    return result;
  }

  async function renameDocument(doc) {
    if (doc.accessRole !== "owner" || doc.deleted) {
      setError("Only the owner can rename an active document.");
      return;
    }

    const title = window.prompt("Enter a new document title:", doc.title);

    if (title === null || !title.trim()) return;

    try {
      const result = await apiRequest(
        `/api/documents/${encodeURIComponent(doc.id)}`,
        {
          method: "PUT",
          body: JSON.stringify({
            title: title.trim(),
            userEmail,
          }),
        }
      );

      const updated = normalizeDocument(result.document, userEmail);

      setDocuments((previous) =>
        previous.map((item) =>
          item.id === updated.id ? updated : item
        )
      );

      setNotice("Document renamed successfully.");
      setError("");
    } catch (err) {
      setError(err.message || "Unable to rename document.");
    }
  }

  async function toggleStar(doc) {
    if (doc.accessRole !== "owner" || doc.deleted) {
      setError("Only the owner can star an active document.");
      return;
    }

    try {
      const result = await apiRequest(
        `/api/documents/${encodeURIComponent(doc.id)}`,
        {
          method: "PUT",
          body: JSON.stringify({
            isStarred: !doc.starred,
            userEmail,
          }),
        }
      );

      const updated = normalizeDocument(result.document, userEmail);

      setDocuments((previous) =>
        previous.map((item) =>
          item.id === updated.id ? updated : item
        )
      );

      setNotice(updated.starred ? "Document starred." : "Star removed.");
      setError("");
    } catch (err) {
      setError(err.message || "Unable to update star.");
    }
  }

  async function moveToTrash(doc) {
    if (doc.accessRole !== "owner") {
      setError("Only the owner can perform this action.");
      return;
    }

    setError("");
    setNotice("");

    try {
      if (doc.deleted) {
        const result = await apiRequest(
          `/api/documents/${encodeURIComponent(doc.id)}/restore`,
          {
            method: "POST",
            body: JSON.stringify({ userEmail }),
          }
        );

        setDocuments((previous) =>
          previous.map((item) =>
            item.id === doc.id
              ? {
                  ...item,
                  deleted: false,
                  isTrashed: false,
                  updatedAt: result.document?.updatedAt || item.updatedAt,
                }
              : item
          )
        );

        setActiveTab("All documents");
        setNotice(result.message || "Document restored successfully.");
        return;
      }

      await apiRequest(
        `/api/documents/${encodeURIComponent(doc.id)}?userEmail=${encodeURIComponent(userEmail)}`,
        { method: "DELETE" }
      );

      setDocuments((previous) =>
        previous.map((item) =>
          item.id === doc.id
            ? { ...item, deleted: true, isTrashed: true }
            : item
        )
      );

      setNotice("Document moved to Trash.");
    } catch (err) {
      setError(err.message || "Unable to update this document.");
    }
  }

  async function importFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    const extension = file.name.split(".").pop()?.toLowerCase();

    if (!["txt", "md"].includes(extension)) {
      setError("Please import a .txt or .md file.");
      event.target.value = "";
      return;
    }

    try {
      const text = await file.text();

      const escaped = text.split(/\r?\n/).map((line) =>
        line
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
      );

      const content = escaped
        .map((line) => `<p>${line || "<br>"}</p>`)
        .join("");

      const result = await apiRequest("/api/documents", {
        method: "POST",
        body: JSON.stringify({
          title: file.name.replace(/\.(txt|md)$/i, ""),
          content,
          userEmail,
        }),
      });

      const doc = normalizeDocument(result.document, userEmail);

      setDocuments((previous) => [doc, ...previous]);
      setActiveDocumentId(doc.id);
      setNotice("File imported and saved to MongoDB.");
      setError("");
    } catch (err) {
      setError(err.message || "Unable to import this file.");
    } finally {
      event.target.value = "";
    }
  }

  function formatDate(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "Recently";

    return date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  if (activeDocumentId) {
    const activeDocument = documents.find(
      (doc) => doc.id === activeDocumentId
    );

    if (activeDocument) {
      return (
        <DocumentEditor
          key={`${userEmail}-${activeDocument.id}`}
          document={activeDocument}
          onBack={() => setActiveDocumentId(null)}
          onSave={saveDocument}
          onShare={shareDocument}
          onRemoveShare={removeCollaborator}
          canShare={activeDocument.accessRole === "owner"}
        />
      );
    }
  }

  const totalDocumentsCount = documents.filter(
    (doc) => !doc.deleted
  ).length;

  const sharedDocumentsCount = documents.filter(
    (doc) => (doc.shared || doc.sharedByMe) && !doc.deleted
  ).length;

  const starredDocumentsCount = documents.filter(
    (doc) => doc.starred && !doc.deleted
  ).length;

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <button
          type="button"
          className="brand"
          onClick={() => {
            setActiveTab("All documents");
            setNotice("");
            setError("");
          }}
        >
          <span className="brand-icon">
            <FileText size={22} />
          </span>
          <span className="brand-copy">
            <strong>NoteSpace</strong>
            <small>Your ideas, organized</small>
          </span>
        </button>

        <button
          type="button"
          className="create-button"
          onClick={createDocument}
        >
          <Plus size={19} />
          <span>New document</span>
          <kbd>Ctrl + N</kbd>
        </button>

        <label className="import-button">
          <FilePlus2 size={18} />
          Import .txt / .md
          <input
            type="file"
            accept=".txt,.md,text/plain,text/markdown"
            onChange={importFile}
            hidden
          />
        </label>

        <p className="nav-label">WORKSPACE</p>

        <nav className="sidebar-nav">
          {[
            { label: "All documents", icon: LayoutGrid },
            { label: "Shared with me", icon: Users },
            { label: "Starred", icon: Star },
            { label: "Trash", icon: Trash2 },
          ].map(({ label, icon: Icon }) => (
            <button
              type="button"
              key={label}
              className={activeTab === label ? "nav-item active" : "nav-item"}
              onClick={() => {
                setActiveTab(label);
                setNotice("");
                setError("");
              }}
            >
              <Icon size={18} />
              {label}
            </button>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div className="workspace-card">
            <span className="workspace-icon">
              <Sparkles size={18} />
            </span>
            <div>
              <strong>Your workspace</strong>
              <p>Ideas become reality.</p>
            </div>
          </div>

          <button
            type="button"
            className="nav-item"
            onClick={() => setNotice("Settings are coming soon.")}
          >
            <Settings size={18} />
            Settings
          </button>

          <button
            type="button"
            className="nav-item"
            onClick={() => setNotice("Help center coming soon.")}
          >
            <HelpCircle size={18} />
            Help &amp; support
          </button>

          <div className="profile">
            <div className="avatar">NS</div>
            <div className="profile-copy">
              <strong>Demo user</strong>
              <small>{userEmail}</small>
            </div>
            <ChevronDown size={17} />
          </div>

          <label className="demo-user-label" htmlFor="demo-user-select">
            Switch demo account
          </label>

          <select
            id="demo-user-select"
            className="demo-user-select"
            value={userEmail}
            onChange={(event) => {
              setUserEmail(event.target.value);
              setActiveTab("All documents");
              setSearch("");
              setNotice("");
              setError("");
            }}
          >
            {DEMO_USERS.map((email) => (
              <option value={email} key={email}>
                {email}
              </option>
            ))}
          </select>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div className="breadcrumb">
            My workspace <span>/</span> <strong>{activeTab}</strong>
          </div>

          <div className="topbar-actions">
            <span className="online-indicator" />
            <span className="topbar-label">MongoDB workspace</span>
            <button
              type="button"
              className="icon-button"
              title="Refresh documents"
              onClick={loadDocuments}
              disabled={loading}
            >
              <RefreshCw size={17} />
            </button>
            <div className="avatar small-avatar">NS</div>
          </div>
        </header>

        <section className="page-content">
          <div className="welcome-row">
            <div>
              <p className="eyebrow">YOUR PERSONAL WORKSPACE</p>
              <h1>{activeTab}</h1>
              <p className="subtitle">
                Capture ideas, organize your work, and bring everything together.
              </p>
            </div>

            {activeTab !== "Trash" && (
              <button
                type="button"
                className="primary-button"
                onClick={createDocument}
              >
                <Plus size={18} />
                Create document
              </button>
            )}
          </div>

          <div className="stats-row">
            <div className="stat-card">
              <div className="stat-icon purple">
                <FileText size={19} />
              </div>
              <div>
                <span>Total documents</span>
                <strong>{totalDocumentsCount}</strong>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon blue">
                <Users size={19} />
              </div>
              <div>
                <span>Shared documents</span>
                <strong>{sharedDocumentsCount}</strong>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon amber">
                <Star size={19} />
              </div>
              <div>
                <span>Starred documents</span>
                <strong>{starredDocumentsCount}</strong>
              </div>
            </div>
          </div>

          <div className="documents-heading">
            <div>
              <h2>{activeTab}</h2>
              <p>{filteredDocuments.length} documents in this view</p>
            </div>

            <div className="document-controls">
              <label className="search-box">
                <Search size={17} />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search documents..."
                />
              </label>

              <div className="view-toggle">
                <button
                  type="button"
                  className={view === "grid" ? "selected" : ""}
                  onClick={() => setView("grid")}
                  aria-label="Grid view"
                >
                  <LayoutGrid size={17} />
                </button>
                <button
                  type="button"
                  className={view === "list" ? "selected" : ""}
                  onClick={() => setView("list")}
                  aria-label="List view"
                >
                  <List size={17} />
                </button>
              </div>
            </div>
          </div>

          {notice && <div className="notice" role="status">{notice}</div>}
          {error && <div className="notice" role="alert">{error}</div>}

          {loading ? (
            <div className="empty-state">
              <p>Loading your documents...</p>
            </div>
          ) : filteredDocuments.length === 0 ? (
            <div className="empty-state">
              <FolderOpen size={42} />
              <h3>
                {activeTab === "Trash" ? "Trash is empty" : "No documents found"}
              </h3>
              <p>
                {activeTab === "Trash"
                  ? "Documents you move to Trash will appear here."
                  : activeTab === "Shared with me"
                    ? "No one has shared a document with this demo account yet."
                    : "Create a document or change your search."}
              </p>
              {activeTab !== "Shared with me" && activeTab !== "Trash" && (
                <button
                  type="button"
                  className="primary-button"
                  onClick={createDocument}
                >
                  <Plus size={18} />
                  New document
                </button>
              )}
            </div>
          ) : (
            <div className={view === "grid" ? "document-grid" : "document-list"}>
              {filteredDocuments.map((doc) => (
                <article className="document-card" key={doc.id}>
                  <div className="document-card-top">
                    <div className="document-file-icon">
                      <FileText size={21} />
                    </div>
                    <button
                      type="button"
                      className="icon-button"
                      title="Rename document"
                      disabled={doc.accessRole !== "owner" || doc.deleted}
                      onClick={() => renameDocument(doc)}
                    >
                      <MoreHorizontal size={21} />
                    </button>
                  </div>

                  <button
                    type="button"
                    className="document-open"
                    onClick={() => openDocument(doc)}
                    disabled={doc.deleted}
                    title={
                      doc.deleted
                        ? "Restore this document before opening"
                        : "Open document"
                    }
                  >
                    <h3>{doc.title}</h3>
                    <p>
                      {doc.content
                        ? doc.content.replace(/<[^>]*>/g, " ").slice(0, 130)
                        : "No content yet. Open to start writing."}
                    </p>
                  </button>

                  <div className="document-card-footer">
                    <span>
                      <Clock3 size={14} />
                      {formatDate(doc.updatedAt)}
                    </span>

                    <div className="card-actions">
                      {doc.shared && !doc.deleted && (
                        <span title={`Shared with you (${doc.accessRole})`}>
                          <Users size={15} />
                        </span>
                      )}

                      {doc.sharedByMe && !doc.deleted && (
                        <span
                          title={`Shared by you with ${doc.collaboratorCount} collaborator(s)`}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4,
                            fontSize: 12,
                          }}
                        >
                          <Users size={15} />
                          Shared by you
                        </span>
                      )}

                      {!doc.deleted && doc.accessRole === "owner" && (
                        <button
                          type="button"
                          className="star-button"
                          title="Share document"
                          aria-label="Share document"
                          onClick={() => openDocument(doc)}
                        >
                          <Share2 size={15} />
                        </button>
                      )}

                      {!doc.deleted && (
                        <button
                          type="button"
                          className={doc.starred ? "star-button starred" : "star-button"}
                          title={doc.starred ? "Remove star" : "Add star"}
                          disabled={doc.accessRole !== "owner"}
                          onClick={() => toggleStar(doc)}
                        >
                          <Star
                            size={16}
                            fill={doc.starred ? "currentColor" : "none"}
                          />
                        </button>
                      )}

                      {doc.accessRole === "owner" && (
                        <button
                          type="button"
                          className="star-button"
                          title={doc.deleted ? "Restore document" : "Move to Trash"}
                          aria-label={doc.deleted ? "Restore document" : "Move to Trash"}
                          onClick={() => moveToTrash(doc)}
                        >
                          {doc.deleted ? (
                            <RotateCcw size={16} />
                          ) : (
                            <Trash2 size={15} />
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}

          <footer className="page-footer">
            <span>
              <Sparkles size={15} />
              Made for thoughtful work
            </span>
            <span>NoteSpace · Your workspace</span>
          </footer>
        </section>
      </main>
    </div>
  );
}

export default App;
