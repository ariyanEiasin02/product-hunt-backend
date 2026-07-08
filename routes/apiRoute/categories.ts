import { Router } from "express";
import {
  categoryDeleteController,
  categoryStatusController,
  createCategoryController,
  createSubcategoryController,
  getCategoriesController,
  getSubcategoriesController,
  subcategoryDeleteController,
  subcategoryStatusController,
  updateCategoryController,
  updateSubCategoryController,
  allGetCategoriesController,
  getCategoryBySlugController,
  getApprovedSubcategoriesController,
  getNavbarCategoriesController,
} from "../../controllers/categoryController.js";
import { isAdmin, verifyToken, optionalAuth } from "../../middleware/authMiddleware.js";
import { uploadImage } from "../../config/multer.js";
import { handleMulterError } from "../../middleware/uploadMiddleware.js";

const router = Router();

router.post("/category", createCategoryController);
router.put("/category/:id", verifyToken, isAdmin, updateCategoryController);
router.get("/getCategory", getCategoriesController);
router.put("/categoryStatus/:id",verifyToken,isAdmin, categoryStatusController);
router.delete("/categoryDelete/:id", verifyToken, isAdmin, categoryDeleteController);
router.post("/subCategory", uploadImage.single("image"), handleMulterError, createSubcategoryController);
router.put("/subCategory/:id", verifyToken, isAdmin, uploadImage.single("image"), handleMulterError, updateSubCategoryController);
router.get("/getSubcategory", getSubcategoriesController);
router.put("/subcategoryStatus/:id", verifyToken, isAdmin, subcategoryStatusController);
router.delete("/subcategoryDelete/:id", verifyToken, isAdmin, subcategoryDeleteController);

// all category and subcategory routes will be here
router.get("/allCategories", allGetCategoriesController);
router.get("/allNavCategories", getNavbarCategoriesController);

// Get approved subcategories for product submission (topic selection)
router.get("/approvedSubcategories", getApprovedSubcategoriesController);

// Get category/subcategory by slug with products
router.get("/:slug", optionalAuth, getCategoryBySlugController);

export default router;
