import { v2 as cloudinary } from "cloudinary";
import streamifier from "streamifier";
import { convertToWebp } from "./imageConverter.js";
import type { WebpConversionOptions } from "./imageConverter.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CloudinaryUploadResult {
  /** Public ID on Cloudinary (used for later deletion / referencing) */
  public_id: string;
  /** Secure HTTPS URL of the uploaded resource */
  secure_url: string;
  /** Original file name */
  original_filename: string;
  /** Resource type (image / video / raw) */
  resource_type: string;
  /** Image width (only for images) */
  width?: number;
  /** Image height (only for images) */
  height?: number;
  /** File size in bytes */
  bytes: number;
  /** Format (png, jpg, webp, etc.) */
  format: string;
}

export interface UploadToCloudinaryOptions {
  /** Cloudinary folder to place the asset in */
  folder?: string;
  /** Public ID override (if omitted Cloudinary generates one) */
  publicId?: string;
  /** Resource type – default "image" */
  resourceType?: "image" | "video" | "raw" | "auto";
  /** Transformation string or object */
  transformation?: string | object;
  /** Whether to use filename as public ID */
  useFilename?: boolean;
  /** Extra Cloudinary upload options (overrides any above) */
  extraOptions?: Record<string, unknown>;

  // ── WebP auto-conversion options (image uploads only) ───────────────────
  /**
   * Set to `false` to skip WebP conversion (e.g. for non-image buffers).
   * Default: `true` for images, N/A for other resource types.
   */
  convertToWebp?: boolean;
  /** Quality (1–100) for WebP output. Default: 80. */
  webpQuality?: number;
  /** Max width (px) — image will be proportionally resized. */
  webpMaxWidth?: number;
  /** Max height (px) — image will be proportionally resized. */
  webpMaxHeight?: number;
  /** Preserve alpha transparency (PNG/GIF). Default: true. */
  webpPreserveTransparency?: boolean;
}

// ---------------------------------------------------------------------------
// Upload helpers
// ---------------------------------------------------------------------------

/**
 * Upload a file **buffer** (typically from multer memory storage) to Cloudinary.
 *
 * **Automatic WebP conversion:**
 * For image uploads (`resourceType: "image"`), the buffer is automatically
 * converted to WebP format using Sharp before being sent to Cloudinary.
 * This reduces storage size and bandwidth while maintaining visual quality.
 *
 * - Pass `convertToWebp: false` to skip conversion (e.g. for format-sensitive use).
 * - Use `webpQuality`, `webpMaxWidth`, `webpMaxHeight` to control the output.
 *
 * @param buffer - The raw file buffer (e.g. `req.file.buffer`).
 * @param options - Optional folder, publicId, WebP settings, etc.
 * @returns A promise that resolves with the Cloudinary upload result.
 *
 * @example
 * const result = await uploadToCloudinary(req.file.buffer, { folder: "avatars" });
 * // Result is always WebP (format: "webp")
 * // result.secure_url => "https://res.cloudinary.com/..."
 */
export async function uploadToCloudinary(
  buffer: Buffer,
  options: UploadToCloudinaryOptions = {}
): Promise<CloudinaryUploadResult> {
  const {
    folder = "",
    publicId,
    resourceType = "image",
    transformation,
    useFilename,
    extraOptions,
    convertToWebp: shouldConvert = true,
    webpQuality = 80,
    webpMaxWidth,
    webpMaxHeight,
    webpPreserveTransparency = true,
  } = options;

  // ── Step 1: Auto-convert image buffers to WebP ───────────────────────────
  let uploadBuffer = buffer;
  let formatIsWebp = false;

  if (shouldConvert && resourceType === "image") {
    // Sharp handles all convertible formats internally and throws on invalid input.
    // The try/catch ensures we never break the upload flow on conversion failure.
    try {
      const webpBuffer = await convertToWebp(buffer, {
        quality: webpQuality,
        preserveTransparency: webpPreserveTransparency,
        maxWidth: webpMaxWidth,
        maxHeight: webpMaxHeight,
        keepMetadata: false,
      });
      uploadBuffer = webpBuffer;
      formatIsWebp = true;
    } catch (conversionError) {
      console.error("[Cloudinary] WebP conversion failed, uploading original:", conversionError);
    }
  }

  // ── Step 2: Upload (converted) buffer to Cloudinary ─────────────────────
  return new Promise((resolve, reject) => {
    const uploadOptions: Record<string, unknown> = {
      folder,
      resource_type: resourceType,
      ...extraOptions,
    };

    if (publicId) uploadOptions.public_id = publicId;
    if (transformation) uploadOptions.transformation = transformation;
    if (useFilename) uploadOptions.use_filename = useFilename;

    // Tell Cloudinary the format is webp so it stores with correct extension
    if (formatIsWebp) {
      uploadOptions.format = "webp";
    }

    const uploadStream = cloudinary.uploader.upload_stream(
      uploadOptions,
      (error, result) => {
        if (error) {
          console.error("[Cloudinary upload_stream] Upload failed:", error);
          reject(error);
          return;
        }

        if (!result) {
          reject(new Error("Cloudinary upload returned an empty result"));
          return;
        }

        const output: CloudinaryUploadResult = {
          public_id: result.public_id,
          secure_url: result.secure_url,
          original_filename: result.original_filename,
          resource_type: result.resource_type,
          width: result.width,
          height: result.height,
          bytes: result.bytes,
          format: result.format,
        };

        resolve(output);
      }
    );

    streamifier.createReadStream(uploadBuffer).pipe(uploadStream);
  });
}

// ---------------------------------------------------------------------------
// Delete helpers
// ---------------------------------------------------------------------------

/**
 * Delete a single resource from Cloudinary by its public_id.
 *
 * @param publicId - The Cloudinary public_id of the resource to delete.
 * @param resourceType - Resource type (default "image").
 * @returns A promise that resolves when deletion is complete.
 *
 * @example
 * await deleteFromCloudinary("avatars/abc123");
 */
export async function deleteFromCloudinary(
  publicId: string,
  resourceType: "image" | "video" | "raw" = "image"
): Promise<{ result: string }> {
  if (!publicId) {
    throw new Error("publicId is required to delete from Cloudinary");
  }

  const result = await cloudinary.uploader.destroy(publicId, {
    resource_type: resourceType,
  });

  return result as { result: string };
}

/**
 * Extract the Cloudinary public_id from a Cloudinary secure_url.
 * Returns `null` if the URL is not a valid Cloudinary URL.
 *
 * @param url - The Cloudinary secure_url (e.g. https://res.cloudinary.com/...)
 * @returns The public_id without the file extension, or null.
 *
 * @example
 * getPublicIdFromUrl("https://res.cloudinary.com/demo/image/upload/v1234/avatars/abc123.png")
 * // => "avatars/abc123"
 */
export function getPublicIdFromUrl(url: string): string | null {
  if (!url || !url.includes("res.cloudinary.com")) {
    return null;
  }

  try {
    // Cloudinary URL format:
    // https://res.cloudinary.com/<cloud_name>/<resource_type>/<type>/v<version>/<public_id>.<ext>
    // or without version:
    // https://res.cloudinary.com/<cloud_name>/<resource_type>/<type>/<public_id>.<ext>
    const urlObj = new URL(url);
    // Split the path and remove the version segment if present
    const segments = urlObj.pathname.split("/");

    // Find the "upload" segment (or other delivery type) and take everything after
    const uploadIndex = segments.findIndex(
      (s) => s === "upload" || s === "authenticated" || s === "private"
    );

    if (uploadIndex === -1 || uploadIndex >= segments.length - 1) {
      return null;
    }

    // Everything after the delivery type segment
    const afterType = segments.slice(uploadIndex + 1).join("/");

    // Remove version prefix like "v1234567/" if present
    const withoutVersion = afterType.replace(/^v\d+\//, "");

    // Remove the file extension at the end
    return withoutVersion.replace(/\.[^.]+$/, "");
  } catch {
    return null;
  }
}

/**
 * Delete a Cloudinary resource by its secure_url.
 * Safely extracts the public_id and deletes. Returns null if the URL
 * doesn't look like a Cloudinary URL.
 *
 * @param url - The Cloudinary secure_url.
 * @param resourceType - Resource type (default "image").
 */
export async function deleteByUrl(
  url: string,
  resourceType: "image" | "video" | "raw" = "image"
): Promise<{ result: string } | null> {
  const publicId = getPublicIdFromUrl(url);

  if (!publicId) {
    console.warn(
      `[Cloudinary] Could not extract public_id from URL: ${url}`
    );
    return null;
  }

  return deleteFromCloudinary(publicId, resourceType);
}

// ---------------------------------------------------------------------------
// Upload multiple files helper
// ---------------------------------------------------------------------------

/**
 * Upload multiple file buffers to Cloudinary in parallel.
 *
 * @param files - Array of multer file objects (must have `buffer` property).
 * @param options - Upload options applied to every file (folder, etc.).
 * @returns Array of upload results in the same order as the input files.
 */
export async function uploadMultipleToCloudinary(
  files: Express.Multer.File[],
  options: UploadToCloudinaryOptions = {}
): Promise<CloudinaryUploadResult[]> {
  // NOTE: We intentionally do NOT pass useFilename here.
  // Cloudinary auto-generates a unique public_id for every upload,
  // ensuring no images overwrite each other.
  const uploads = files.map((file) =>
    uploadToCloudinary(file.buffer, options)
  );

  return Promise.all(uploads);
}

export default {
  uploadToCloudinary,
  deleteFromCloudinary,
  getPublicIdFromUrl,
  deleteByUrl,
  uploadMultipleToCloudinary,
};
