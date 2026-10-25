
import { useEffect, useState } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import ItalicExtension from "@tiptap/extension-italic";

import {
  ArrowLeft,
  Bold,
  Italic as ItalicIcon,
  Underline as UnderlineIcon,
  List,
  ListOrdered,
  Heading1,
  Heading2,
  Pilcrow,
  Save,
  CheckCircle2,
  Share2,
  X,
  Mail,
  ShieldCheck,
  UserRound,
  Trash2,
} from "lucide-react";

import "./DocumentEditor.css";

export default function DocumentEditor({
  document,
  onBack,
  onSave,
  onShare,
  onRemoveShare,
  canShare = true,
}) {
  const [title, setTitle] = useState(document.title || "");
  const [saving, setSaving] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [shareEmail, setShareEmail] = useState("");
  const [shareRole, setShareRole] = useState("viewer");
  const [shareError, setShareError] = useState("");
  const [shareSuccess, setShareSuccess] = useState("");
  const [error, setError] = useState("");
  const [showShareModal, setShowShareModal] = useState(false);
  const [managingEmail, setManagingEmail] = useState("");

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        italic: false,
        underline: false,
      }),
      ItalicExtension,
      Underline,
    ],
    content: document.content || "",
    editable: document.accessRole !== "viewer",
    editorProps: {
      attributes: {
        class: "tiptap-content",
        "aria-label": "Document content editor",
      },
    },
  });

  useEffect(() => {
    setTitle(document.title || "");

    if (editor && editor.getHTML() !== (document.content || "")) {
      editor.commands.setContent(document.content || "");
    }

    if (editor) {
      editor.setEditable(document.accessRole !== "viewer");
    }
  }, [
    editor,
    document.id,
    document.title,
    document.content,
    document.accessRole,
  ]);

  async function handleSave() {
    if (document.accessRole === "viewer") {
      setError("You have view-only access to this document.");
      return;
    }

    if (!title.trim()) {
      setError("Please enter a document title.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      await onSave({
        ...document,
        title: title.trim(),
        content: editor?.getHTML() || "",
      });
    } catch (err) {
      setError(err.message || "Unable to save document.");
    } finally {
      setSaving(false);
    }
  }

  async function handleShare(event) {
    event.preventDefault();

    const email = shareEmail.trim().toLowerCase();

    if (!email) {
      setShareError("Please enter the collaborator's email.");
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setShareError("Please enter a valid email address.");
      return;
    }

    if (typeof onShare !== "function") {
      setShareError("Sharing is not connected. Please update App.jsx.");
      return;
    }

    setSharing(true);
    setShareError("");
    setShareSuccess("");

    try {
      const result = await onShare({
        document,
        email,
        role: shareRole,
      });

      setShareSuccess(
        result.message || `Document shared with ${email} as ${shareRole}.`
      );
      setShareEmail("");
    } catch (err) {
      setShareError(err.message || "Unable to share this document.");
    } finally {
      setSharing(false);
    }
  }

  async function handleRoleChange(email, role) {
    setManagingEmail(email);
    setShareError("");
    setShareSuccess("");

    try {
      if (typeof onShare !== "function") {
        throw new Error("Sharing is not connected.");
      }

      await onShare({ document, email, role });
      setShareSuccess(`Permission updated for ${email}.`);
    } catch (err) {
      setShareError(err.message || "Could not update permission.");
    } finally {
      setManagingEmail("");
    }
  }

  async function handleRemoveCollaborator(email) {
    const confirmed = window.confirm(
      `Remove ${email} from this document?`
    );

    if (!confirmed) return;

    if (typeof onRemoveShare !== "function") {
      setShareError("Remove collaborator feature is not connected.");
      return;
    }

    setManagingEmail(email);
    setShareError("");
    setShareSuccess("");

    try {
      const result = await onRemoveShare({ document, email });
      setShareSuccess(result.message || `Access removed for ${email}.`);
    } catch (err) {
      setShareError(err.message || "Could not remove collaborator.");
    } finally {
      setManagingEmail("");
    }
  }

  if (!editor) {
    return <div className="editor-loading">Opening editor...</div>;
  }

  const isViewer = document.accessRole === "viewer";

  const collaborators = Array.isArray(document.sharedWith)
    ? document.sharedWith.filter(
        (person) =>
          person.email?.toLowerCase() !==
          document.ownerEmail?.toLowerCase()
      )
    : [];

  return (
    <main className="rich-editor-page">
      <header className="rich-editor-header">
        <button
          type="button"
          className="editor-brand"
          onClick={onBack}
        >
          <span className="editor-brand-icon">N</span>
          <span>NoteSpace</span>
        </button>

        <div className="editor-save-status">
          <CheckCircle2 size={15} />
          <span>
            {saving
              ? "Saving..."
              : isViewer
                ? "View only"
                : "Ready to save"}
          </span>
        </div>

        <div className="editor-header-actions">
          {canShare && (
            <button
              type="button"
              className="editor-share-button"
              onClick={() => {
                setShareError("");
                setShareSuccess("");
                setSharing(false);
                setManagingEmail("");
                setShareRole("viewer");
                setShareEmail("");
                setShowShareModal(true);
              }}
            >
              <Share2 size={17} />
              Share
            </button>
          )}

          <button
            type="button"
            className="editor-save-button"
            onClick={handleSave}
            disabled={saving || isViewer}
          >
            <Save size={17} />
            {saving ? "Saving..." : "Save document"}
          </button>
        </div>
      </header>

      <section className="rich-editor-paper">
        <button
          type="button"
          className="editor-back-button"
          onClick={onBack}
        >
          <ArrowLeft size={16} />
          All documents
        </button>

        <input
          className="rich-editor-title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Untitled document"
          aria-label="Document title"
          disabled={isViewer}
        />

        {isViewer && (
          <p className="editor-permission-note">
            You have Viewer permission. You can read this document but
            cannot edit it.
          </p>
        )}

        <div className="formatting-toolbar">
          <button
            type="button"
            title="Paragraph"
            className={!editor.isActive("heading") ? "tool-active" : ""}
            disabled={isViewer}
            onClick={() => editor.chain().focus().setParagraph().run()}
          >
            <Pilcrow size={17} />
          </button>

          <span className="toolbar-divider" />

          <button
            type="button"
            title="Heading 1"
            className={
              editor.isActive("heading", { level: 1 }) ? "tool-active" : ""
            }
            disabled={isViewer}
            onClick={() =>
              editor.chain().focus().toggleHeading({ level: 1 }).run()
            }
          >
            <Heading1 size={18} />
          </button>

          <button
            type="button"
            title="Heading 2"
            className={
              editor.isActive("heading", { level: 2 }) ? "tool-active" : ""
            }
            disabled={isViewer}
            onClick={() =>
              editor.chain().focus().toggleHeading({ level: 2 }).run()
            }
          >
            <Heading2 size={18} />
          </button>

          <span className="toolbar-divider" />

          <button
            type="button"
            title="Bold"
            className={editor.isActive("bold") ? "tool-active" : ""}
            disabled={isViewer}
            onClick={() => editor.chain().focus().toggleBold().run()}
          >
            <Bold size={17} />
          </button>

          <button
            type="button"
            title="Italic"
            className={editor.isActive("italic") ? "tool-active" : ""}
            disabled={isViewer}
            onClick={() => editor.chain().focus().toggleItalic().run()}
          >
            <ItalicIcon size={17} />
          </button>

          <button
            type="button"
            title="Underline"
            className={editor.isActive("underline") ? "tool-active" : ""}
            disabled={isViewer}
            onClick={() =>
              editor.chain().focus().toggleUnderline().run()
            }
          >
            <UnderlineIcon size={17} />
          </button>

          <span className="toolbar-divider" />

          <button
            type="button"
            title="Bullet list"
            className={
              editor.isActive("bulletList") ? "tool-active" : ""
            }
            disabled={isViewer}
            onClick={() =>
              editor.chain().focus().toggleBulletList().run()
            }
          >
            <List size={18} />
          </button>

          <button
            type="button"
            title="Numbered list"
            className={
              editor.isActive("orderedList") ? "tool-active" : ""
            }
            disabled={isViewer}
            onClick={() =>
              editor.chain().focus().toggleOrderedList().run()
            }
          >
            <ListOrdered size={18} />
          </button>
        </div>

        <EditorContent editor={editor} />

        {error && (
          <p role="alert" className="notice">
            {error}
          </p>
        )}

        <div className="rich-editor-footer">
          <span>Rich-text document</span>
          <span>
            {isViewer
              ? "View-only access"
              : "Remember to save your changes"}
          </span>
        </div>
      </section>

      {showShareModal && (
        <div
          className="share-modal-overlay"
          onMouseDown={(event) => {
            if (
              event.target === event.currentTarget &&
              !sharing &&
              !managingEmail
            ) {
              setShowShareModal(false);
            }
          }}
        >
          <section
            className="share-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="share-modal-title"
          >
            <header className="share-modal-header">
              <div className="share-modal-heading">
                <span className="share-modal-icon">
                  <Share2 size={21} />
                </span>

                <div>
                  <h2 id="share-modal-title">Share document</h2>
                  <p>Invite someone to access this document.</p>
                </div>
              </div>

              <button
                type="button"
                className="share-modal-close"
                aria-label="Close share dialog"
                disabled={sharing || Boolean(managingEmail)}
                onClick={() => setShowShareModal(false)}
              >
                <X size={20} />
              </button>
            </header>

            <form className="share-modal-form" onSubmit={handleShare}>
              <label htmlFor="collaborator-email">
                Collaborator email
              </label>

              <div className="share-email-input-wrap">
                <Mail size={18} />
                <input
                  id="collaborator-email"
                  type="email"
                  placeholder="colleague@example.com"
                  value={shareEmail}
                  onChange={(event) => setShareEmail(event.target.value)}
                  disabled={sharing || Boolean(managingEmail)}
                  required
                />
              </div>

              <label htmlFor="collaborator-role">Permission</label>

              <div className="share-role-input-wrap">
                <ShieldCheck size={18} />
                <select
                  id="collaborator-role"
                  value={shareRole}
                  onChange={(event) => setShareRole(event.target.value)}
                  disabled={sharing || Boolean(managingEmail)}
                >
                  <option value="viewer">Viewer — Can view only</option>
                  <option value="editor">Editor — Can edit document</option>
                </select>
              </div>

              <div className="share-permission-help">
                {shareRole === "viewer"
                  ? "The collaborator can read the document but cannot make changes."
                  : "The collaborator can edit and save the document."}
              </div>

              <div className="existing-collaborators" style={{ marginTop: 22 }}>
                <h3 style={{ marginBottom: 8 }}>People with access</h3>

                {collaborators.length === 0 ? (
                  <p className="share-permission-help">
                    No collaborators yet. Share this document using the form above.
                  </p>
                ) : (
                  collaborators.map((person) => (
                    <div
                      key={person.email}
                      className="collaborator-row"
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 10,
                        flexWrap: "wrap",
                        padding: "10px 0",
                        borderBottom: "1px solid #e5e7eb",
                      }}
                    >
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 6,
                          fontSize: 13,
                          overflowWrap: "anywhere",
                        }}
                      >
                        <UserRound size={15} />
                        {person.email}
                      </span>

                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                        }}
                      >
                        <select
                          aria-label={`Permission for ${person.email}`}
                          value={person.role}
                          disabled={sharing || Boolean(managingEmail)}
                          onChange={(event) =>
                            handleRoleChange(person.email, event.target.value)
                          }
                        >
                          <option value="viewer">Viewer</option>
                          <option value="editor">Editor</option>
                        </select>

                        <button
                          type="button"
                          className="share-cancel-button"
                          disabled={sharing || Boolean(managingEmail)}
                          onClick={() =>
                            handleRemoveCollaborator(person.email)
                          }
                          title={`Remove ${person.email}`}
                        >
                          {managingEmail === person.email
                            ? "Updating..."
                            : (
                              <>
                                <Trash2 size={14} />
                                Remove
                              </>
                            )}
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {shareError && (
                <p className="share-message share-error" role="alert">
                  {shareError}
                </p>
              )}

              {shareSuccess && (
                <p className="share-message share-success" role="status">
                  {shareSuccess}
                </p>
              )}

              <footer className="share-modal-actions">
                <button
                  type="button"
                  className="share-cancel-button"
                  disabled={sharing || Boolean(managingEmail)}
                  onClick={() => setShowShareModal(false)}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="share-submit-button"
                  disabled={sharing || Boolean(managingEmail)}
                >
                  <Share2 size={16} />
                  {sharing ? "Sharing..." : "Share document"}
                </button>
              </footer>
            </form>
          </section>
        </div>
      )}
    </main>
  );
}
