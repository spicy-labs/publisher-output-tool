# Security Notes

## API Key Storage in Browser Cookie (Ticket: high-api-key-in-plaintext-cookie)

**Assessment: Low — best-practice cleanup, not a meaningful security vulnerability.**

Security reviews will flag that the CHILI Publish API key is stored in a `document.cookie` the risk is overstated for this application's architecture. The three claimed attack vectors do not hold up in context:

### 1. Network Interception — Not Applicable Over HTTPS

The cookie is only sent automatically to the app's own origin server. That server is a static file server that does not read or process cookies (`server.js`). The API key is sent to the CHILI API via explicit `fetch()` calls in JavaScript, not via cookie headers.

When served over HTTPS (required for production), cookie contents cannot be sniffed in transit. Adding the `Secure` flag is good practice to prevent fallback over HTTP, but does not address an exploitable vulnerability.

### 2. XSS Credential Theft — Storage Mechanism Is Irrelevant

Any attacker with JavaScript execution in the page can read credentials from `document.cookie`, `sessionStorage`, `localStorage`, React component state, or by intercepting `fetch()` calls. The storage mechanism does not change the outcome of an XSS attack.

Additionally, the application does not render user-supplied HTML or use `dangerouslySetInnerHTML`, so no XSS vector is present in the current codebase.

### 3. Session Hijacking — Inherent to Client-Side API Key Usage

A stolen API key grants access to the CHILI Publish environment regardless of how it was stored. This is a property of using API keys in a client-side application, not of the cookie storage choice. The API key is visible in outbound network requests to the CHILI API (`frontend/chili.ts`), so any compromised browser context (malicious extension, injected script) can extract it from network traffic without reading storage at all.

### Supporting Evidence

- **Server ignores cookies**: `server.js` is a static file server with no cookie parsing or session handling.
- **API key sent via fetch, not cookies**: All CHILI API calls in `frontend/chili.ts` pass the API key as a request parameter, not via cookie headers. The cookie is used purely as a client-side storage mechanism.
- **No XSS surface**: The application does not render untrusted HTML content.
- **Browser compromise is game over regardless**: A compromised browser environment can read any client-side storage mechanism and intercept any network request.

