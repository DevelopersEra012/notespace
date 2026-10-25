
const mongoose = require("mongoose");

const collaboratorSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    role: {
      type: String,
      enum: ["viewer", "editor"],
      default: "viewer",
    },
  },
  { _id: false }
);

const documentSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
      default: "Untitled document",
    },

    content: {
      type: String,
      default: "",
    },

    ownerEmail: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      index: true,
    },

    sharedWith: {
      type: [collaboratorSchema],
      default: [],
    },

    isStarred: {
      type: Boolean,
      default: false,
    },

    isTrashed: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

documentSchema.index({ ownerEmail: 1, updatedAt: -1 });

module.exports = mongoose.model("Document", documentSchema);
