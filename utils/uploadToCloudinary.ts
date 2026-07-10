import { v2 as cloudinary } from "cloudinary";
import streamifier from "streamifier";

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
}

// ---------------------------------------------------------------------------
// Upload helpers
// ---------------------------------------------------------------------------

/**
 * Upload a file **buffer** (typically from multer memory storage) to Cloudinary.
 *
 * @param buffer - The raw file buffer (e.g. `req.file.buffer`).
 * @param options - Optional folder, publicId, resourceType, etc.
 * @returns A promise that resolves with the Cloudinary upload result.
 *
 * @example
 * const result = await uploadToCloudinary(req.file.buffer, { folder: "avatars" });
 * // result.secure_url => "https://res.cloudinary.com/..."
 * // result.public_id  => "avatars/abc123"
 */
export function uploadToCloudinary(
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
  } = options;

  return new Promise((resolve, reject) => {
    // Build upload options for Cloudinary
    const uploadOptions: Record<string, unknown> = {
      folder,
      resource_type: resourceType,
      ...extraOptions,
    };

    if (publicId) uploadOptions.public_id = publicId;
    if (transformation) uploadOptions.transformation = transformation;
    if (useFilename) uploadOptions.use_filename = useFilename;

    // Create an upload stream and pipe the buffer into it
    const uploadStream = cloudinary.uploader.upload_stream(
      uploadOptions,
      (error, result) => {
        if (error) {
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

    // Pipe the buffer into the stream
    streamifier.createReadStream(buffer).pipe(uploadStream);
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
  const uploads = files.map((file) =>
    uploadToCloudinary(file.buffer, {
      ...options,
      useFilename: true,
    })
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
