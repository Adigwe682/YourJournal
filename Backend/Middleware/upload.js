import "dotenv/config"; // Loads environment variables immediately
import multer from "multer";
import { v2 as cloudinary } from "cloudinary";
import { CloudinaryStorage } from "multer-storage-cloudinary";

// Configure Cloudinary using your environment variables
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Set up Cloudinary storage engine for Multer
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: "your_journal_trades", // Folder name in your Cloudinary dashboard
    allowed_formats: ["jpg", "jpeg", "png", "webp"],
  },
});

const upload = multer({
  storage: storage,
  // Reject oversized files before they reach Cloudinary, so the
  // error handler can return a clear JSON message instead of a 500.
  limits: {
    fileSize: 10 * 1024 * 1024, // 10 MB, matches Cloudinary's cap
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype && file.mimetype.startsWith("image/")) {
      return cb(null, true);
    }

    const error = new Error("Unsupported image format");
    error.http_code = 400;
    cb(error);
  },
});

export default upload;