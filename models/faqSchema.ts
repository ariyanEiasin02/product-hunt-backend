import mongoose, { Document, Schema } from "mongoose";

export interface IFaq extends Document {
  question: string;
  answer: string;
  status: "draft" | "published";
  createdAt: Date;
  updatedAt: Date;
}

const FaqSchema = new Schema<IFaq>(
  {
    question: {
      type: String,
      required: true,
      trim: true,
    },
    answer: {
      type: String,
      required: true,
      trim: true,
    },
    status: {
      type: String,
      enum: ["draft", "published"],
      default: "draft",
    },
  },
  { timestamps: true },
);

const Faq: mongoose.Model<IFaq> =
  (mongoose.models["Faq"] as mongoose.Model<IFaq>) ??
  mongoose.model<IFaq>("Faq", FaqSchema);

export default Faq;
