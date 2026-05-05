# Product Hunt Backend API

A robust, feature-rich backend API built with **Node.js**, **Express**, **TypeScript**, and **MongoDB**. This server powers a Product Hunt-style application with real-time capabilities, file uploads, and comprehensive product management.

---

## 🎯 Features

- **Authentication & Authorization**: JWT-based authentication with secure password hashing (bcryptjs)
- **Product Management**: Create, read, update, and delete products with image uploads
- **User Profiles**: Comprehensive user management and profile customization
- **Reviews & Ratings**: Product review system with rating capabilities
- **Comments**: Nested comment system for product discussions
- **Search**: Advanced search and filtering functionality
- **Categories**: Product categorization system
- **Real-time Features**: Socket.IO integration for live notifications and updates
- **File Uploads**: Multer integration for thumbnail and gallery image uploads
- **Leaderboard**: User ranking system based on product performance
- **Visit Tracking**: Product view counter and visit streak tracking
- **Dashboard**: Analytics and statistics for users
- **Email Notifications**: Nodemailer integration for sending emails
- **FAQs & Stories**: Content management for FAQs and user stories
- **CORS Support**: Configurable cross-origin resource sharing

---

## 🚀 Quick Start

### Prerequisites

- **Node.js** (v16 or higher)
- **npm** or **yarn**
- **MongoDB** (local or cloud instance - MongoDB Atlas)

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd product-hunt-backend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment variables**
   ```bash
   cp .env.example .env
   ```
   Update `.env` with your configuration:
   ```env
   PORT=5000
   NODE_ENV=development
   MONGODB_URI=mongodb://localhost:27017/product-hunt
   JWT_SECRET=your_jwt_secret_key
   ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001
   EMAIL_USER=your_email@gmail.com
   EMAIL_PASS=your_app_password
   ```

4. **Run the development server**
   ```bash
   npm run dev
   ```
   The server will start at `http://localhost:5000`

---

## 📦 Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start development server with auto-reload (tsx watch) |
| `npm run build` | Compile TypeScript to JavaScript |
| `npm start` | Run production build |

---

## 🏗️ Project Structure

```
product-hunt-backend/
├── config/              # Configuration files
│   ├── db.ts           # MongoDB connection
│   └── socket.ts       # Socket.IO configuration
├── controllers/         # Business logic handlers
├── models/             # MongoDB Mongoose schemas
├── routes/             # API route definitions
│   └── apiRoute/
│       ├── authentication.ts    # Auth routes
│       ├── product.ts          # Product routes
│       ├── reviews.ts          # Review routes
│       ├── comments.ts         # Comment routes
│       ├── profile.ts          # Profile routes
│       ├── search.ts           # Search routes
│       ├── leaderboard.ts      # Leaderboard routes
│       ├── notification.ts     # Notification routes
│       ├── categories.ts       # Category routes
│       ├── dashboard.ts        # Dashboard routes
│       ├── upload.ts           # File upload routes
│       └── ...
├── middleware/         # Custom middleware (auth, validation)
├── utils/             # Helper functions
├── uploads/           # Uploaded files directory
├── index.ts           # Application entry point
├── tsconfig.json      # TypeScript configuration
└── package.json       # Project dependencies
```

---

## 📚 API Documentation

### Base URL
```
http://localhost:5000/api
```

### Authentication Routes
- `POST /auth/register` - Register new user
- `POST /auth/login` - User login
- `POST /auth/logout` - User logout
- `POST /auth/refresh-token` - Refresh JWT token

### Product Routes
- `GET /products` - Get all products (with pagination & filtering)
- `GET /products/:id` - Get product details
- `POST /products` - Create new product (requires auth)
- `PUT /products/:id` - Update product (requires auth)
- `DELETE /products/:id` - Delete product (requires auth)

### Review Routes
- `GET /reviews/product/:productId` - Get reviews for product
- `POST /reviews` - Create review (requires auth)
- `PUT /reviews/:id` - Update review (requires auth)
- `DELETE /reviews/:id` - Delete review (requires auth)

### Comment Routes
- `GET /comments/product/:productId` - Get comments for product
- `POST /comments` - Create comment (requires auth)
- `PUT /comments/:id` - Update comment (requires auth)
- `DELETE /comments/:id` - Delete comment (requires auth)

### Profile Routes
- `GET /profile/user/:userId` - Get user profile
- `PUT /profile/:userId` - Update user profile (requires auth)
- `GET /profile/leaderboard` - Get user leaderboard

### Search & Filter
- `GET /search?query=keyword` - Search products and users
- `GET /products/category/:categoryId` - Filter by category

### Real-time Features (Socket.IO)
- `notification` - Real-time notifications
- `product-update` - Live product updates
- `comment-added` - Real-time comment updates

---

## 🔐 Authentication

The API uses **JWT (JSON Web Tokens)** for authentication.

### Token Format
```
Authorization: Bearer <your_jwt_token>
```

### Protected Endpoints
Add the `Authorization` header to protected endpoints:
```bash
curl -H "Authorization: Bearer YOUR_TOKEN" http://localhost:5000/api/profile/user/123
```

---

## 📤 File Upload

The API supports file uploads for product images using **Multer**.

### Upload Endpoints

**Product Thumbnail & Gallery Upload**
```
POST /api/upload/product
Content-Type: multipart/form-data

Form fields:
- thumbnail (file)
- gallery (file)
```

### Supported File Types
- Images: `.jpg`, `.jpeg`, `.png`, `.webp`

### Upload Limitations
- Max file size: 10MB per file
- Upload directory: `./uploads/`

For detailed upload instructions, see [PRODUCT_UPLOAD_GUIDE.md](./PRODUCT_UPLOAD_GUIDE.md) and [UPLOAD_API.md](./UPLOAD_API.md).

---

## 🗄️ Database Models

### User Model
- User authentication and profile information
- Email verification
- Password hashing with bcryptjs

### Product Model
- Product details (name, description, category)
- Image references (thumbnail, gallery)
- Timestamps and view count
- User ownership

### Review Model
- Rating system (1-5 stars)
- Review text and metadata
- User and product association

### Comment Model
- Nested comment support
- Comment threads
- User information

### Category Model
- Product categorization
- Category metadata

---

## 🔧 Environment Variables

Create a `.env` file in the root directory:

```env
# Server Configuration
PORT=5000
NODE_ENV=development

# Database
MONGODB_URI=mongodb://localhost:27017/product-hunt
DATABASE_NAME=product-hunt

# Authentication
JWT_SECRET=your_super_secret_jwt_key_change_this
JWT_EXPIRE=7d

# CORS
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001,http://127.0.0.1:3000

# Email (Optional - for notifications)
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_app_password

# File Upload
UPLOAD_DIR=./uploads
MAX_FILE_SIZE=10485760

# Socket.IO
SOCKET_IO_ORIGIN=http://localhost:3000
```

---

## 🛠️ Development

### TypeScript Configuration

This project uses **TypeScript** with the latest ECMAScript modules (ESM).

- **Compiler**: `tsc`
- **Dev Server**: `tsx` (faster and more reliable than ts-node)
- **Configuration**: See `tsconfig.json` for detailed settings

### Running with Hot Reload

The development server automatically reloads on file changes:
```bash
npm run dev
```

### Building for Production

```bash
npm run build
npm start
```

---

## 🚨 Error Handling

The API uses standardized error responses:

```json
{
  "success": false,
  "message": "Error description",
  "error": "ERROR_CODE"
}
```

### Common Status Codes
- `200` - OK
- `201` - Created
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `500` - Internal Server Error

---

## 📋 Additional Documentation

For detailed information about specific features:

- **[PRODUCT_UPLOAD_GUIDE.md](./PRODUCT_UPLOAD_GUIDE.md)** - Complete product upload guide
- **[UPLOAD_API.md](./UPLOAD_API.md)** - File upload API reference
- **[MULTER_SETUP.md](./MULTER_SETUP.md)** - Multer configuration details
- **[PRODUCT_API.md](./PRODUCT_API.md)** - Product API endpoints
- **[REVIEW_API.md](./REVIEW_API.md)** - Review API endpoints
- **[COMMENT_API.md](./COMMENT_API.md)** - Comment API endpoints

---

## 📦 Dependencies

### Core Dependencies
- **express** - Web framework
- **mongoose** - MongoDB ODM
- **jsonwebtoken** - JWT authentication
- **bcryptjs** - Password hashing
- **multer** - File upload handling
- **cors** - Cross-origin resource sharing
- **socket.io** - Real-time communication
- **nodemailer** - Email sending

### Dev Dependencies
- **typescript** - TypeScript compiler
- **tsx** - TypeScript executor
- **@types/** - Type definitions

---

## 🤝 Contributing

1. Create a feature branch: `git checkout -b feature/new-feature`
2. Commit your changes: `git commit -m 'Add new feature'`
3. Push to the branch: `git push origin feature/new-feature`
4. Open a pull request

---

## 📄 License

This project is licensed under the **MIT License** - see the [LICENSE](./LICENSE) file for details.

---

## 👨‍💻 Author

**Eiasin** - [GitHub](https://github.com/eiasin)

---

## 🆘 Support

For issues, questions, or suggestions, please open an [issue](https://github.com/eiasin/product-hunt-backend/issues) on GitHub.

---

## 🔗 Related Projects

- [Product Hunt Frontend](https://github.com/eiasin/product-hunt-frontend) - React-based frontend application

---

**Last Updated**: May 2026  
**Version**: 1.0.0
