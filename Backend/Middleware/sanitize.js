// ============================================
// INPUT SANITIZATION MIDDLEWARE
// --------------------------------------------
// Deep-cleans request payloads before they reach any controller:
//
//   - Drops NoSQL operator keys ("$where", "$gt", ...) and keys
//     containing "." ("a.b") that Mongo would interpret as operators
//   - Strips null bytes and control characters from strings
//   - Caps string length and nesting depth to block abuse
//   - Preserves non-plain values (Dates, Buffers, numbers, etc.)
//
// Used globally in Server.js (JSON bodies, query, params) and again
// on trade routes after Multer parses multipart/form-data fields.
// ============================================

const MAX_STRING_LENGTH = 10000;
const MAX_DEPTH = 6;
const MAX_KEYS = 500;

// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

const isUnsafeKey = (key) => key.startsWith("$") || key.includes(".");

const cleanString = (value) => {
  let cleaned = value.replace(CONTROL_CHARS, "");

  if (cleaned.length > MAX_STRING_LENGTH) {
    cleaned = cleaned.slice(0, MAX_STRING_LENGTH);
  }

  return cleaned;
};

// Returns a sanitized copy, or undefined when the value must be dropped
const deepSanitize = (value, depth = 0) => {
  if (depth > MAX_DEPTH) return undefined;

  if (typeof value === "string") return cleanString(value);

  if (Array.isArray(value)) {
    return value
      .map((item) => deepSanitize(item, depth + 1))
      .filter((item) => item !== undefined);
  }

  if (value !== null && typeof value === "object") {
    // Only walk plain objects/arrays - leave Dates, Buffers, etc. alone
    const proto = Object.getPrototypeOf(value);
    if (proto !== Object.prototype && proto !== null) return value;

    const sanitized = {};
    let keyCount = 0;

    for (const [key, val] of Object.entries(value)) {
      if (++keyCount > MAX_KEYS) break;
      if (isUnsafeKey(key)) continue;

      const cleaned = deepSanitize(val, depth + 1);

      if (cleaned !== undefined) {
        sanitized[key] = cleaned;
      }
    }

    return sanitized;
  }

  // numbers, booleans, null pass through unchanged
  return value;
};

// req.query / req.params are getters in Express 5 - define an own
// property on the request instance so the sanitized value is what
// controllers actually read.
const shadowProperty = (req, name, value) => {
  Object.defineProperty(req, name, {
    value,
    writable: true,
    configurable: true,
    enumerable: true,
  });
};

const sanitizeInput = (req, res, next) => {
  try {
    if (req.body && typeof req.body === "object") {
      req.body = deepSanitize(req.body) ?? {};
    }

    if (req.query && typeof req.query === "object") {
      shadowProperty(req, "query", deepSanitize(req.query) ?? {});
    }

    if (req.params && typeof req.params === "object") {
      shadowProperty(req, "params", deepSanitize(req.params) ?? {});
    }

    next();
  } catch (error) {
    console.error("Input sanitization error:", error.message);

    res.status(400).json({
      success: false,
      message: "Invalid request payload.",
    });
  }
};

export default sanitizeInput;
