// ============================================
// SINGLE SOURCE OF TRUTH FOR API URLS
// --------------------------------------------
// Every page/script should use these globals instead of
// hardcoding URLs:
//
//   SERVER_URL -> backend root        (auth routes: /users/...)
//   API_URL    -> backend api mount   (trades, reports, admin)
//
// While testing locally everything points at localhost:4000.
// When you deploy, the hostname check below automatically
// switches to the Render URL - no other file needs editing.
// ============================================

(function () {
  const host = window.location.hostname;

  const isLocal =
    host === "" || // opened via file://
    host === "localhost" ||
    host === "127.0.0.1";

  const SERVER_URL = isLocal
    ? "http://localhost:4000"
    : "https://yourjournal.onrender.com";

  window.SERVER_URL = SERVER_URL;
  window.API_URL = `${SERVER_URL}/api`;
  window.AUTH_URL = `${SERVER_URL}/users`;
})();
