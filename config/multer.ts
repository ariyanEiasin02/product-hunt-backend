import multer from "multer";
import path from "path";
import { Request } from "express";

// Define allowed file types
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
const ALLOWED_VIDEO_TYPES = ["video/mp4", "video/webm", "video/ogg"];
const ALLOWED_DOCUMENT_TYPES = ["application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"];

// File size limits (in bytes)
const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_VIDEO_SIZE = 50 * 1024 * 1024; // 50MB
const MAX_DOCUMENT_SIZE = 10 * 1024 * 1024; // 10MB

// Configure storage for different file types
const storage = multer.diskStorage({
  destination: (req: Request, file: Express.Multer.File, cb) => {
    // Determine destination based on field name or file type
    let uploadPath = "uploads/";

    if (file.fieldname === "thumbnail" || file.fieldname === "gallery") {
      uploadPath += "products/";
    } else if (file.fieldname === "avatar" || file.fieldname === "profileImage") {
      uploadPath += "users/";
    } else if (file.mimetype.startsWith("video/")) {
      uploadPath += "videos/";
    } else if (file.mimetype.startsWith("image/")) {
      uploadPath += "images/";
    } else {
      uploadPath += "documents/";
    }

    cb(null, uploadPath);
  },
  filename: (req: Request, file: Express.Multer.File, cb) => {
    // Create unique filename with timestamp and random string
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    const nameWithoutExt = path.basename(file.originalname, ext);
    const sanitizedName = nameWithoutExt.replace(/[^a-zA-Z0-9]/g, "-").toLowerCase();
    cb(null, `${sanitizedName}-${uniqueSuffix}${ext}`);
  },
});

// Memory storage for cloud uploads (e.g., AWS S3, Cloudinary)
const memoryStorage = multer.memoryStorage();

// File filter function
const fileFilter = (
  req: Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) => {
  const allowedTypes = [
    ...ALLOWED_IMAGE_TYPES,
    ...ALLOWED_VIDEO_TYPES,
    ...ALLOWED_DOCUMENT_TYPES,
  ];

  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new Error(
        `Invalid file type. Allowed types: ${allowedTypes.join(", ")}`
      )
    );
  }
};

// Image file filter (GIF not allowed for product thumbnails)
const imageFilter = (
  req: Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) => {
  if (file.mimetype === "image/gif") {
    cb(new Error("GIF images are not allowed. Please use JPG, PNG, or WebP."));
    return;
  }
  if (ALLOWED_IMAGE_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Only image files are allowed (JPG, PNG, WebP)"));
  }
};

// Video file filter
const videoFilter = (
  req: Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) => {
  if (ALLOWED_VIDEO_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Only video files (MP4, WebM, OGG) are allowed"));
  }
};

// General upload configuration (disk storage)
export const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: MAX_IMAGE_SIZE,
    files: 10, // Maximum 10 files at once
  },
});

// Memory storage configuration for cloud uploads
export const uploadMemory = multer({
  storage: memoryStorage,
  fileFilter: fileFilter,
  limits: {
    fileSize: MAX_IMAGE_SIZE,
    files: 10,
  },
});

// Image upload configuration
export const uploadImage = multer({
  storage: storage,
  fileFilter: imageFilter,
  limits: {
    fileSize: MAX_IMAGE_SIZE,
    files: 1,
  },
});

// Multiple images upload configuration
export const uploadImages = multer({
  storage: storage,
  fileFilter: imageFilter,
  limits: {
    fileSize: MAX_IMAGE_SIZE,
    files: 10, // Allow up to 10 images
  },
});

// Video upload configuration
export const uploadVideo = multer({
  storage: storage,
  fileFilter: videoFilter,
  limits: {
    fileSize: MAX_VIDEO_SIZE,
    files: 1,
  },
});

// Product media upload (thumbnail + gallery)
export const uploadProductMedia = multer({
  storage: storage,
  fileFilter: imageFilter,
  limits: {
    fileSize: MAX_IMAGE_SIZE,
    files: 11, // 1 thumbnail + 10 gallery images
  },
});

// Avatar/Profile image upload
export const uploadAvatar = multer({
  storage: storage,
  fileFilter: imageFilter,
  limits: {
    fileSize: MAX_IMAGE_SIZE,
    files: 1,
  },
});

// Memory storage for images (for cloud uploads)
export const uploadImageMemory = multer({
  storage: memoryStorage,
  fileFilter: imageFilter,
  limits: {
    fileSize: MAX_IMAGE_SIZE,
    files: 1,
  },
});

// Memory storage for multiple images (for cloud uploads)
export const uploadImagesMemory = multer({
  storage: memoryStorage,
  fileFilter: imageFilter,
  limits: {
    fileSize: MAX_IMAGE_SIZE,
    files: 10,
  },
});

// Export constants for use in other files
export const FILE_SIZE_LIMITS = {
  IMAGE: MAX_IMAGE_SIZE,
  VIDEO: MAX_VIDEO_SIZE,
  DOCUMENT: MAX_DOCUMENT_SIZE,
};

export const ALLOWED_FILE_TYPES = {
  IMAGES: ALLOWED_IMAGE_TYPES,
  VIDEOS: ALLOWED_VIDEO_TYPES,
  DOCUMENTS: ALLOWED_DOCUMENT_TYPES,
};

export default {
  upload,
  uploadMemory,
  uploadImage,
  uploadImages,
  uploadVideo,
  uploadProductMedia,
  uploadAvatar,
  uploadImageMemory,
  uploadImagesMemory,
  FILE_SIZE_LIMITS,
  ALLOWED_FILE_TYPES,
};
