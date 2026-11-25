// ============================================
// GLOBAL ERROR HANDLER
// --------------------------------------------
// Mounted last in Server.js. Without it, any error thrown inside
// Multer/Cloudinary falls through to Express's default handler,
// which replies with an HTML error page. The frontend then crashes
// on response.json() with "Unexpected token '<'".
//
// Every failure therefore returns JSON with a message a trader can
// actually act on.
// ============================================

// Cloudinary / Multer rejections -> human-readable messages
const MESSAGE_RULES = [
  {
    // Multer's own limit, or Cloudinary's 10 MB cap
    test: (code, message) => code === "LIMIT_FILE_SIZE" || /file size too large/i.test(message),
    status: 413,
    message: "That screenshot is too large. Maximum size is 10 MB.",
  },
  {
    // Rejected file type, from either our fileFilter or Cloudinary
    test: (code, message) =>
      /format not allowed|invalid image file|unsupported image|only image files/i.test(message),
    status: 400,
    message: "Unsupported image format. Use a JPG, PNG or WebP under 10 MB.",
  },
];

const errorHandler = (error, req, res, next) => {
  // Response already started - nothing sensible left to do
  if (res.headersSent) {
    return next(error);
  }

  const message = String(error?.message || "");
  const rule = MESSAGE_RULES.find(({ test }) => test(error?.code, message));

  if (rule) {
    return res.status(rule.status).json({
      success: false,
      message: rule.message,
    });
  }

  console.error("Unhandled request error:", message || error);

  res.status(500).json({
    success: false,
    message: "Server error",
  });
};

export default errorHandler;
