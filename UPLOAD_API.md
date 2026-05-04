# File Upload API Documentation (Multer)

## Overview

Professional file upload system using Multer with TypeScript. Supports image, video, and document uploads with validation, error handling, and file management.

---

## Setup & Installation

### Install Dependencies

```bash
npm install multer
npm install --save-dev @types/multer
```

### Directory Structure

```
uploads/
├── products/     # Product thumbnails and gallery
├── users/        # User avatars and profiles
├── images/       # General images
├── videos/       # Video files
└── documents/    # Documents and PDFs
```

---

## Configuration

### File Size Limits

- **Images**: 5MB
- **Videos**: 50MB
- **Documents**: 10MB

### Allowed File Types

- **Images**: JPEG, JPG, PNG, WebP, GIF
- **Videos**: MP4, WebM, OGG
- **Documents**: PDF, DOC, DOCX

---

## Endpoints

### 1. Upload Single Image

**POST** `/api/upload/image`

Upload a single image file.

#### Authentication

Required: Yes

#### Form Data

- `image`: Image file (required)

#### Example Request (using fetch)

```javascript
const formData = new FormData();
formData.append("image", fileInput.files[0]);

const response = await fetch("/api/upload/image", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${token}`,
  },
  body: formData,
});
```

#### Example Request (using Postman)

- Method: POST
- URL: http://localhost:3000/api/upload/image
- Headers: Authorization: Bearer {token}
- Body: form-data
  - Key: image (type: File)
  - Value: Select image file

#### Response

```json
{
  "success": true,
  "message": "Image uploaded successfully",
  "data": {
    "url": "http://localhost:3000/uploads/my-image-1234567890-987654321.jpg",
    "filename": "my-image-1234567890-987654321.jpg",
    "originalName": "my-image.jpg",
    "size": "2.5 MB",
    "mimetype": "image/jpeg"
  }
}
```

---

### 2. Upload Multiple Images

**POST** `/api/upload/images`

Upload up to 10 images at once.

#### Authentication

Required: Yes

#### Form Data

- `images`: Multiple image files (max 10)

#### Example Request

```javascript
const formData = new FormData();
for (let i = 0; i < files.length; i++) {
  formData.append("images", files[i]);
}

const response = await fetch("/api/upload/images", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${token}`,
  },
  body: formData,
});
```

#### Response

```json
{
  "success": true,
  "message": "3 image(s) uploaded successfully",
  "data": {
    "files": [
      {
        "url": "http://localhost:3000/uploads/image1-1234567890-123.jpg",
        "filename": "image1-1234567890-123.jpg",
        "originalName": "image1.jpg",
        "size": "1.2 MB",
        "mimetype": "image/jpeg"
      },
      {
        "url": "http://localhost:3000/uploads/image2-1234567890-456.png",
        "filename": "image2-1234567890-456.png",
        "originalName": "image2.png",
        "size": "800 KB",
        "mimetype": "image/png"
      }
    ],
    "count": 2
  }
}
```

---

### 3. Upload Product Media

**POST** `/api/upload/product-media`

Upload product thumbnail and gallery images.

#### Authentication

Required: Yes

#### Form Data

- `thumbnail`: Single thumbnail image (optional)
- `gallery`: Multiple gallery images (max 10, optional)

#### Example Request

```javascript
const formData = new FormData();
formData.append("thumbnail", thumbnailFile);

galleryFiles.forEach((file) => {
  formData.append("gallery", file);
});

const response = await fetch("/api/upload/product-media", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${token}`,
  },
  body: formData,
});
```

#### Response

```json
{
  "success": true,
  "message": "Product media uploaded successfully",
  "data": {
    "thumbnail": {
      "url": "http://localhost:3000/uploads/thumbnail-1234567890-123.jpg",
      "filename": "thumbnail-1234567890-123.jpg",
      "size": "2.1 MB"
    },
    "gallery": [
      {
        "url": "http://localhost:3000/uploads/gallery1-1234567890-456.jpg",
        "filename": "gallery1-1234567890-456.jpg",
        "size": "1.8 MB"
      },
      {
        "url": "http://localhost:3000/uploads/gallery2-1234567890-789.jpg",
        "filename": "gallery2-1234567890-789.jpg",
        "size": "2.3 MB"
      }
    ]
  }
}
```

---

### 4. Upload Avatar

**POST** `/api/upload/avatar`

Upload user avatar/profile picture.

#### Authentication

Required: Yes

#### Form Data

- `avatar`: Avatar image file (required)

#### Example Request

```javascript
const formData = new FormData();
formData.append("avatar", avatarFile);

const response = await fetch("/api/upload/avatar", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${token}`,
  },
  body: formData,
});
```

#### Response

```json
{
  "success": true,
  "message": "Avatar uploaded successfully",
  "data": {
    "url": "http://localhost:3000/uploads/avatar-1234567890-123.jpg",
    "filename": "avatar-1234567890-123.jpg",
    "size": "500 KB"
  }
}
```

---

### 5. Delete File

**DELETE** `/api/upload/:filename`

Delete an uploaded file.

#### Authentication

Required: Yes

#### URL Parameters

- `filename`: Name of the file to delete

#### Example Request

```javascript
const response = await fetch("/api/upload/my-image-1234567890-123.jpg", {
  method: "DELETE",
  headers: {
    Authorization: `Bearer ${token}`,
  },
});
```

#### Response

```json
{
  "success": true,
  "message": "File deleted successfully"
}
```

---

## Error Responses

### 400 Bad Request - File Size Exceeded

```json
{
  "success": false,
  "message": "File size exceeds the maximum allowed limit",
  "error": "File too large"
}
```

### 400 Bad Request - Invalid File Type

```json
{
  "success": false,
  "message": "Only image files (JPEG, PNG, WebP, GIF) are allowed"
}
```

### 400 Bad Request - Too Many Files

```json
{
  "success": false,
  "message": "Too many files uploaded",
  "error": "Too many files"
}
```

### 400 Bad Request - No File Uploaded

```json
{
  "success": false,
  "message": "No file uploaded"
}
```

### 401 Unauthorized

```json
{
  "success": false,
  "message": "User not authenticated"
}
```

### 404 Not Found

```json
{
  "success": false,
  "message": "File not found or already deleted"
}
```

---

## Features

### ✅ Multiple Upload Configurations

- Single image upload
- Multiple images upload
- Product media (thumbnail + gallery)
- Avatar upload
- Video upload
- Document upload

### ✅ File Validation

- File type validation (MIME type)
- File size limits
- Maximum file count
- Extension validation

### ✅ Storage Options

- Disk storage (local filesystem)
- Memory storage (for cloud uploads like AWS S3, Cloudinary)

### ✅ Security

- Authentication required for uploads
- File type restrictions
- Size limits
- Filename sanitization

### ✅ Error Handling

- Multer error middleware
- Custom validation errors
- File cleanup on errors
- Detailed error messages

### ✅ Utility Functions

- File info extraction
- URL generation
- File deletion
- Filename sanitization
- Size formatting

---

## Usage in Controllers

### Import Multer Config

```typescript
import { uploadImage, uploadImages } from "../config/multer.js";
import { handleMulterError } from "../middleware/uploadMiddleware.js";
```

### Use in Routes

```typescript
router.post(
  "/upload/image",
  authenticate,
  uploadImage.single("image"),
  handleMulterError,
  uploadController,
);
```

---

## File Structure Created

```
config/
  └── multer.ts              # Multer configuration
middleware/
  └── uploadMiddleware.ts    # Upload middleware & error handling
utils/
  └── fileUploadHelper.ts    # File utility functions
controllers/
  └── uploadController.ts    # Upload controllers
routes/
  └── apiRoute/
      └── upload.ts          # Upload routes
```

---

## Environment Variables

Add to your `.env` file:

```env
BASE_URL=http://localhost:3000
MAX_FILE_SIZE=5242880
```

---

## Integration Example

### React/Next.js Frontend

```typescript
const handleFileUpload = async (file: File) => {
  const formData = new FormData();
  formData.append("image", file);

  try {
    const response = await fetch("/api/upload/image", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${localStorage.getItem("token")}`,
      },
      body: formData,
    });

    const data = await response.json();

    if (data.success) {
      console.log("File uploaded:", data.data.url);
      // Use the file URL in your application
    }
  } catch (error) {
    console.error("Upload failed:", error);
  }
};
```

### HTML Form

```html
<form id="uploadForm" enctype="multipart/form-data">
  <input type="file" name="image" accept="image/*" required />
  <button type="submit">Upload</button>
</form>

<script>
  document
    .getElementById("uploadForm")
    .addEventListener("submit", async (e) => {
      e.preventDefault();
      const formData = new FormData(e.target);

      const response = await fetch("/api/upload/image", {
        method: "POST",
        headers: {
          Authorization: "Bearer " + token,
        },
        body: formData,
      });

      const result = await response.json();
      console.log(result);
    });
</script>
```

---

## Best Practices

1. **Always validate on server-side** - Never trust client-side validation alone
2. **Set appropriate size limits** - Prevent abuse and server overload
3. **Use authentication** - Protect upload endpoints
4. **Clean up failed uploads** - Remove files if errors occur
5. **Generate unique filenames** - Prevent filename collisions
6. **Store file URLs in database** - Reference uploaded files in your models
7. **Consider cloud storage** - For production, use AWS S3, Cloudinary, etc.
8. **Implement rate limiting** - Prevent upload spam
9. **Scan for malware** - In production, scan uploaded files
10. **Serve files properly** - Use express.static or CDN

---

## Next Steps

1. **Add to main routes**: Import and use the upload routes in your main API router
2. **Create upload directories**: Run `createUploadDirectories()` on server start
3. **Configure static serving**: Add `app.use('/uploads', express.static('uploads'))`
4. **Integrate with cloud storage**: Replace disk storage with S3/Cloudinary in production
5. **Add image optimization**: Use Sharp for image resizing and optimization
