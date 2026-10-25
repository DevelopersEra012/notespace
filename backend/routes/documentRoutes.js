
const express = require("express");
const mongoose = require("mongoose");
const Document = require("../models/Document");

const router = express.Router();

function normalizeEmail(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function getUserEmail(req) {
  return normalizeEmail(
    req.query.userEmail ||
      req.body.userEmail ||
      req.headers["x-user-email"]
  );
}

function validDocumentId(id) {
  return mongoose.isValidObjectId(id);
}

function getCollaborators(document) {
  return Array.isArray(document.sharedWith) ? document.sharedWith : [];
}

function hasAccess(document, email) {
  if (!email || !document) return false;

  return (
    normalizeEmail(document.ownerEmail) === email ||
    getCollaborators(document).some(
      (person) => normalizeEmail(person.email) === email
    )
  );
}

function canEdit(document, email) {
  if (!email || !document) return false;

  if (normalizeEmail(document.ownerEmail) === email) {
    return true;
  }

  return getCollaborators(document).some(
    (person) =>
      normalizeEmail(person.email) === email &&
      person.role === "editor"
  );
}

// GET /api/documents
// Owners can see active and trashed documents.
// Collaborators can see only active documents shared with them.
router.get("/", async (req, res) => {
  try {
    const email = getUserEmail(req);

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "userEmail is required.",
      });
    }

    const documents = await Document.find({
      $or: [
        { ownerEmail: email },
        {
          "sharedWith.email": email,
          isTrashed: false,
        },
      ],
    }).sort({ updatedAt: -1 });

    const result = documents.map((doc) => {
      const plainDoc = doc.toObject();

      const sharedPerson = getCollaborators(doc).find(
        (person) => normalizeEmail(person.email) === email
      );

      const isOwner = normalizeEmail(doc.ownerEmail) === email;

      return {
        ...plainDoc,
        accessRole: isOwner
          ? "owner"
          : sharedPerson?.role || "viewer",
      };
    });

    return res.json({
      success: true,
      documents: result,
    });
  } catch (error) {
    console.error("GET DOCUMENTS ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Could not fetch documents.",
    });
  }
});

// POST /api/documents
// Create document.
router.post("/", async (req, res) => {
  try {
    const ownerEmail = getUserEmail(req);

    const title =
      typeof req.body.title === "string" && req.body.title.trim()
        ? req.body.title.trim()
        : "Untitled document";

    const content =
      typeof req.body.content === "string"
        ? req.body.content
        : "";

    if (!ownerEmail) {
      return res.status(400).json({
        success: false,
        message: "userEmail is required.",
      });
    }

    const document = await Document.create({
      title,
      content,
      ownerEmail,
    });

    return res.status(201).json({
      success: true,
      message: "Document created successfully.",
      document,
    });
  } catch (error) {
    console.error("CREATE DOCUMENT ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Could not create document.",
    });
  }
});

// GET /api/documents/:id
// Get one active document when the user has access.
router.get("/:id", async (req, res) => {
  try {
    const email = getUserEmail(req);

    if (!validDocumentId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid document ID.",
      });
    }

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "userEmail is required.",
      });
    }

    const document = await Document.findById(req.params.id);

    if (!document || document.isTrashed) {
      return res.status(404).json({
        success: false,
        message: "Document not found.",
      });
    }

    if (!hasAccess(document, email)) {
      return res.status(403).json({
        success: false,
        message: "You do not have access to this document.",
      });
    }

    const sharedPerson = getCollaborators(document).find(
      (person) => normalizeEmail(person.email) === email
    );

    return res.json({
      success: true,
      document: {
        ...document.toObject(),
        accessRole:
          normalizeEmail(document.ownerEmail) === email
            ? "owner"
            : sharedPerson?.role || "viewer",
      },
    });
  } catch (error) {
    console.error("GET DOCUMENT ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Could not fetch document.",
    });
  }
});

// PUT /api/documents/:id
// Update title, content, or star status.
router.put("/:id", async (req, res) => {
  try {
    const email = getUserEmail(req);

    if (!validDocumentId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid document ID.",
      });
    }

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "userEmail is required.",
      });
    }

    const document = await Document.findById(req.params.id);

    if (!document || document.isTrashed) {
      return res.status(404).json({
        success: false,
        message: "Document not found.",
      });
    }

    if (!canEdit(document, email)) {
      return res.status(403).json({
        success: false,
        message: "You do not have permission to edit this document.",
      });
    }

    if (typeof req.body.title === "string") {
      const title = req.body.title.trim();

      if (!title || title.length > 200) {
        return res.status(400).json({
          success: false,
          message: "Title must be between 1 and 200 characters.",
        });
      }

      document.title = title;
    }

    if (typeof req.body.content === "string") {
      document.content = req.body.content;
    }

    if (typeof req.body.isStarred === "boolean") {
      if (normalizeEmail(document.ownerEmail) !== email) {
        return res.status(403).json({
          success: false,
          message: "Only the owner can change starred status.",
        });
      }

      document.isStarred = req.body.isStarred;
    }

    await document.save();

    return res.json({
      success: true,
      message: "Document updated successfully.",
      document,
    });
  } catch (error) {
    console.error("UPDATE DOCUMENT ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Could not update document.",
    });
  }
});

// POST /api/documents/:id/share
// Share a document or update a collaborator's role.
router.post("/:id/share", async (req, res) => {
  try {
    const ownerEmail = getUserEmail(req);
    const recipientEmail = normalizeEmail(req.body.email);
    const role = req.body.role || "viewer";

    if (!validDocumentId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid document ID.",
      });
    }

    if (!ownerEmail || !recipientEmail) {
      return res.status(400).json({
        success: false,
        message: "Owner email and collaborator email are required.",
      });
    }

    if (!["viewer", "editor"].includes(role)) {
      return res.status(400).json({
        success: false,
        message: "Role must be viewer or editor.",
      });
    }

    const document = await Document.findById(req.params.id);

    if (!document || document.isTrashed) {
      return res.status(404).json({
        success: false,
        message: "Document not found.",
      });
    }

    if (normalizeEmail(document.ownerEmail) !== ownerEmail) {
      return res.status(403).json({
        success: false,
        message: "Only the owner can share this document.",
      });
    }

    if (recipientEmail === ownerEmail) {
      return res.status(400).json({
        success: false,
        message: "You cannot share a document with its owner.",
      });
    }

    if (!Array.isArray(document.sharedWith)) {
      document.sharedWith = [];
    }

    const existing = document.sharedWith.find(
      (person) => normalizeEmail(person.email) === recipientEmail
    );

    if (existing) {
      existing.role = role;
    } else {
      document.sharedWith.push({
        email: recipientEmail,
        role,
      });
    }

    await document.save();

    console.log("DOCUMENT SHARED SUCCESSFULLY:", {
      documentId: document._id.toString(),
      ownerEmail,
      recipientEmail,
      role,
    });

    return res.json({
      success: true,
      message: `Document shared with ${recipientEmail} successfully.`,
      document,
    });
  } catch (error) {
    console.error("SHARE DOCUMENT ERROR:", error);

    return res.status(500).json({
      success: false,
      message: error.message || "Could not share document.",
    });
  }
});

// DELETE /api/documents/:id/share/:email
// Remove a collaborator's access.
router.delete("/:id/share/:email", async (req, res) => {
  try {
    const ownerEmail = getUserEmail(req);
    const recipientEmail = normalizeEmail(req.params.email);

    if (!validDocumentId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid document ID.",
      });
    }

    if (!ownerEmail || !recipientEmail) {
      return res.status(400).json({
        success: false,
        message: "Owner and collaborator emails are required.",
      });
    }

    const document = await Document.findById(req.params.id);

    if (!document) {
      return res.status(404).json({
        success: false,
        message: "Document not found.",
      });
    }

    if (normalizeEmail(document.ownerEmail) !== ownerEmail) {
      return res.status(403).json({
        success: false,
        message: "Only the owner can remove collaborators.",
      });
    }

    const collaborators = getCollaborators(document);

    const remaining = collaborators.filter(
      (person) => normalizeEmail(person.email) !== recipientEmail
    );

    if (remaining.length === collaborators.length) {
      return res.status(404).json({
        success: false,
        message: "Collaborator was not found on this document.",
      });
    }

    document.sharedWith = remaining;
    await document.save();

    return res.json({
      success: true,
      message: `Access removed for ${recipientEmail}.`,
      document,
    });
  } catch (error) {
    console.error("REMOVE COLLABORATOR ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Could not remove collaborator.",
    });
  }
});

// POST /api/documents/:id/restore
// Restore a document from Trash.
router.post("/:id/restore", async (req, res) => {
  try {
    const email = getUserEmail(req);

    if (!validDocumentId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid document ID.",
      });
    }

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "userEmail is required.",
      });
    }

    const document = await Document.findById(req.params.id);

    if (!document) {
      return res.status(404).json({
        success: false,
        message: "Document not found.",
      });
    }

    if (normalizeEmail(document.ownerEmail) !== email) {
      return res.status(403).json({
        success: false,
        message: "Only the owner can restore this document.",
      });
    }

    if (!document.isTrashed) {
      return res.json({
        success: true,
        message: "Document is already active.",
        document,
      });
    }

    document.isTrashed = false;
    await document.save();

    return res.json({
      success: true,
      message: "Document restored successfully.",
      document,
    });
  } catch (error) {
    console.error("RESTORE DOCUMENT ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Could not restore document.",
    });
  }
});

// DELETE /api/documents/:id
// Soft-delete a document: move it to Trash.
router.delete("/:id", async (req, res) => {
  try {
    const email = getUserEmail(req);

    if (!validDocumentId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid document ID.",
      });
    }

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "userEmail is required.",
      });
    }

    const document = await Document.findById(req.params.id);

    if (!document || document.isTrashed) {
      return res.status(404).json({
        success: false,
        message: "Document not found.",
      });
    }

    if (normalizeEmail(document.ownerEmail) !== email) {
      return res.status(403).json({
        success: false,
        message: "Only the owner can move this document to Trash.",
      });
    }

    document.isTrashed = true;
    await document.save();

    return res.json({
      success: true,
      message: "Document moved to Trash.",
    });
  } catch (error) {
    console.error("DELETE DOCUMENT ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Could not delete document.",
    });
  }
});

module.exports = router;
