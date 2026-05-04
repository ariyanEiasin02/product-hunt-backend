import mongoose, { Document, Schema } from "mongoose";

export interface IStory extends Document {
  title: string;
  slug: string;
  summary: string;
  content: string;
  coverImage: string;
  tags: string[];
  author: {
    name: string;
    avatar: string;
  };
  status: "draft" | "published";
  isFeatured: boolean;
  readTime: string;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const StorySchema = new Schema<IStory>(
  {
    title: {
      type: String,
      required: [true, "Story title is required"],
      maxlength: [200, "Title cannot exceed 200 characters"],
      trim: true,
    },
    slug: {
      type: String,
      unique: true,
      required: true,
      lowercase: true,
      trim: true,
    },
    summary: {
      type: String,
      maxlength: [500, "Summary cannot exceed 500 characters"],
      trim: true,
    },
    content: {
      type: String,
      required: [true, "Story content is required"],
    },
    coverImage: {
      type: String,
      default: "",
    },
    tags: {
      type: [String],
      default: [],
      set: (tags: string[]) =>
        tags.map((tag) => tag.trim().toLowerCase()),
    },
    author: {
      name: { type: String, required: true, trim: true },
      avatar: { type: String, default: "" },
    },
    status: {
      type: String,
      enum: ["draft", "published"],
      default: "draft",
    },
    isFeatured: {
      type: Boolean,
      default: false,
    },
    publishedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

// Always sanitize slug (fix spaces, special chars, etc.)
StorySchema.pre("save", function () {
  if (!this.slug && this.title) {
    this.slug = this.title
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, "")
      .replace(/[\s_-]+/g, "-")
      .replace(/^-+|-+$/g, "");
  } else if (this.slug) {
    // Always sanitize existing slug to prevent spaces/special chars
    this.slug = this.slug
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, "")
      .replace(/[\s_-]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  // Auto-calculate read time from content (avg 200 words/min)
  if (this.content) {
    const plainText = this.content.replace(/<[^>]+>/g, "");
    const wordCount = plainText.split(/\s+/).filter(Boolean).length;
    const minutes = Math.max(1, Math.ceil(wordCount / 200));
    this.readTime = `${minutes} min read`;
  }

  // Set publishedAt when status changes to published
  if (this.isModified("status") && this.status === "published" && !this.publishedAt) {
    this.publishedAt = new Date();
  }
});

// Indexes for performance
StorySchema.index({ slug: 1 });
StorySchema.index({ status: 1, publishedAt: -1 });
StorySchema.index({ tags: 1 });
StorySchema.index({ isFeatured: 1, publishedAt: -1 });
StorySchema.index({ title: "text", summary: "text", content: "text", tags: "text" });

const Story =
  mongoose.models.Story || mongoose.model<IStory>("Story", StorySchema);

export default Story;
