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

// Fail loudly at boot rather than on the first trade save.
// Render does not read Backend/.env (it is gitignored), so these
// must be set in the service's Environment tab.
const missingCloudinaryVars = [
  "CLOUDINARY_CLOUD_NAME",
  "CLOUDINARY_API_KEY",
  "CLOUDINARY_API_SECRET",
].filter((name) => !process.env[name]);

if (missingCloudinaryVars.length > 0) {
  console.warn(
    `[upload] WARNING: missing ${missingCloudinaryVars.join(", ")}. ` +
      "Screenshot uploads will fail with 'Must supply api_key'. " +
      "Set them in Render -> Environment."
  );
} else {
  // Credentials are present - verify they actually match Cloudinary.
  // A wrong/whitespace-corrupted secret shows up here at boot instead
  // of as an "Invalid Signature" error on the first trade save.
  const describeCloudinaryError = (error) => {
    if (!error) return "unknown error";
    if (typeof error === "string") return error;
    return (
      error.message ||
      (typeof error.error === "string" ? error.error : "") ||
      error.error?.message ||
      JSON.stringify(error.error || error)
    );
  };

  cloudinary.api
    .ping()
    .then(() => console.log("[upload] Cloudinary credentials verified."))
    .catch((error) =>
      console.warn(
        `[upload] WARNING: Cloudinary credentials REJECTED (${describeCloudinaryError(error)}). ` +
          "Re-copy CLOUDINARY_CLOUD_NAME / API_KEY / API_SECRET from Backend/.env " +
          "with no stray spaces or quotes."
      )
    );
}

// Set up Cloudinary storage engine for Multer
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: "your_journal_trades", // Folder name in your Cloudinary dashboard
    allowed_formats: ["jpg", "jpeg", "png", "webp"],
  },
});

const upload = multer({
  storage: storage,  // Reject oversized files before they reach Cloudinary, so the
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