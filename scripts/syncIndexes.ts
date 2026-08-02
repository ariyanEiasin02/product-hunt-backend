/**
 * One-off script to build/verify all Mongoose indexes against MongoDB.
 *
 * The app disables `autoIndex` in production (faster cold starts). Run this
 * ONCE after the first deploy to a production database:
 *
 *   npm run sync-indexes
 *
 * It connects, then calls syncIndexes() on every model. Idempotent — safe to
 * re-run after adding new indexes in code.
 */
import dotenv from "dotenv";
dotenv.config();

import mongoose from "mongoose";
import User from "../models/userSchema.js";
import Product from "../models/productSchema.js";
import Category from "../models/categorySchema.js";
import Subcategory from "../models/subcategorySchema.js";
import Comment from "../models/commentSchema.js";
import Review from "../models/reviewSchema.js";
import Story from "../models/storySchema.js";
import Notification from "../models/notificationSchema.js";
import Faq from "../models/faqSchema.js";
import Page from "../models/pageSchema.js";
import ProductGuide from "../models/productGuideSchema.js";
import VisitStreak from "../models/visitStreakSchema.js";

const models = [
  User,
  Product,
  Category,
  Subcategory,
  Comment,
  Review,
  Story,
  Notification,
  Faq,
  Page,
  ProductGuide,
  VisitStreak,
];

async function main(): Promise<void> {
  const mongoURI = process.env.MONGO_URI;
  if (!mongoURI) {
    console.error("MONGO_URI is not set");
    process.exit(1);
  }

  console.log("Connecting to MongoDB...");
  await mongoose.connect(mongoURI, { serverSelectionTimeoutMS: 10000 });
  console.log("Connected. Syncing indexes...");

  for (const model of models) {
    const modelName = model.modelName;
    try {
      const info = await model.syncIndexes();
      console.log(`  ✓ ${modelName}: ${(info as any).length ?? "ok"}`);
    } catch (err) {
      console.error(`  ✗ ${modelName}:`, (err as Error).message);
    }
  }

  await mongoose.disconnect();
  console.log("Done.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
