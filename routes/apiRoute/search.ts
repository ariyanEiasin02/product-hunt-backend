import { Router } from "express";
import { globalSearchController } from "../../controllers/searchController.js";

const router = Router();

// GET /api/search?q=<query>&limit=<number>
router.get("/", globalSearchController);

export default router;
