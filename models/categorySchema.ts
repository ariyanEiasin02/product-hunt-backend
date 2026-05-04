import mongoose, { Document, Schema } from "mongoose";
export interface ICategory extends Document {
  name: string;
  slug: string;
  description?: string;
  subcategories?: mongoose.Types.ObjectId[];
  isActive: boolean;
  status: "waiting" | "rejected" | "approved";
  createdAt: Date;
  updatedAt: Date;
}
const CategorySchema = new Schema<ICategory>({
  name: {
    type: String,
    required: true,
  },
  slug: {
    type: String,
    required: true,
    unique: true,
  },
  description: {
    type: String,
  },
  subcategories: [{
      type: Schema.Types.ObjectId,
      ref: "Subcategory",
    }],
  isActive: {
    type: Boolean,
    default: false,
  },
  status: {
    type: String,
    default: "waiting",
    enum: ["waiting", "rejected", "approved"],
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

const Category = mongoose.models.Category || mongoose.model<ICategory>("Category", CategorySchema);
export default Category;
