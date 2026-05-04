import { Router } from "express";
import apiRouter from "./apiRoute/index.js";

const router = Router();

// fallback if env is undefined
const BASE_URL = "/api";

router.use(BASE_URL, apiRouter);

export default router;
