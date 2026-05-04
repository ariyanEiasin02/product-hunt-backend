import mongoose, { Document, Schema } from "mongoose";

export interface IPage extends Document {
  title: string;
  slug: string;
  content: string;
  status: "draft" | "published";
  createdAt: Date;
  updatedAt: Date;
}

const PageSchema = new Schema<IPage>(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    content: {
      type: String,
      default: "",
    },
    status: {
      type: String,
      enum: ["draft", "published"],
      default: "draft",
    },
  },
  { timestamps: true },
);

// For tsx watch (full process restart), direct registration is safe.
// Guard against accidental double-registration in shared module contexts.
const Page: mongoose.Model<IPage> =
  (mongoose.models["Page"] as mongoose.Model<IPage>) ??
  mongoose.model<IPage>("Page", PageSchema);

export default Page;
