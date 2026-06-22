// Runtime configuration for the Fintrex Contractors portal.
// This file is served as-is by GitHub Pages. Edit in place on the server (or
// in your deployment) to change the API base URL WITHOUT rebuilding the SPA.
//
// The global name is intentionally brand-agnostic (__APP_CONFIG__) so future
// rebrands don't ripple through the codebase. Older bundles still set the
// legacy __SAMWISE_CONFIG__ alias for backwards-compat - see api.ts.
window.__APP_CONFIG__ = {
  apiUrl: "https://api.fintrexcontractors.com",
  // Optional: override brand name shown in the header.
  brand: "Fintrex Contractors",
};
// Legacy alias - kept until every cached browser bundle has been replaced.
window.__SAMWISE_CONFIG__ = window.__APP_CONFIG__;
