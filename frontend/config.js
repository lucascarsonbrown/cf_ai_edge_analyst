/**
 * API configuration.
 * API_BASE_URL is empty so all requests use relative URLs.
 * This works automatically in both local dev (wrangler dev) and production
 * since the frontend is served from the same Worker as the API.
 */
const CONFIG = {
  API_BASE_URL: "",
  POLL_INTERVAL_MS: 2000,
};
