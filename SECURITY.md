# Security Audit Report — Cyclos 4 Frontend (Angular 18 Fork)

**Date:** 2026-03-20
**Version:** 4.16.14
**Framework:** Angular 18.2.14
**Scope:** Full frontend security analysis of the forked repository

---

## Executive Summary

This security audit covers the forked Cyclos 4 Frontend Angular 18 application. The analysis identified **48 dependency vulnerabilities** (1 critical, 32 high, 9 moderate, 6 low) and several code-level security concerns. Immediate fixes have been applied to address the most critical issues.

### Fixes Applied in This Audit

| Fix | Severity | Description |
|-----|----------|-------------|
| Replace `xmldom` with `@xmldom/xmldom` | **CRITICAL** | Replaced deprecated, vulnerable `xmldom` (CVE-2022-39353, CVE-2021-21366) with its maintained fork |
| Add `rel="noopener noreferrer"` to external links | **MEDIUM** | Prevents reverse tabnabbing on all `target="_blank"` links |
| Remove hardcoded GeoServer URL | **MEDIUM** | Moved `http://localhost:8080/geoserver/...` to environment config |
| Fix proxy `secure: false` | **LOW** | Changed to `secure: true` in development proxy config |
| Fix `immutable` prototype pollution | **HIGH** | Updated `immutable` package via `npm audit fix` |

---

## 1. Dependency Vulnerabilities

### 1.1 Critical (Fixed)

| Package | Vulnerability | Advisory | Status |
|---------|--------------|----------|--------|
| `xmldom` ^0.6.0 | Multiple root nodes in DOM / Prototype Pollution | [GHSA-crh6-fp67-6883](https://github.com/advisories/GHSA-crh6-fp67-6883), [GHSA-5fg8-2547-mr8q](https://github.com/advisories/GHSA-5fg8-2547-mr8q) | ✅ **Fixed** — replaced with `@xmldom/xmldom` ^0.9.8 |

### 1.2 High (Remaining — Requires Angular Major Upgrade)

These vulnerabilities are in the Angular 18.x core framework and can only be resolved by upgrading to Angular 19+:

| Package | Vulnerability | Advisory |
|---------|--------------|----------|
| `@angular/core` ≤18.2.14 | XSS via SVG attributes | [GHSA-c75v-2vq8-878f](https://github.com/advisories/GHSA-c75v-2vq8-878f) |
| `@angular/core` ≤18.2.14 | XSS via unsanitized SVG script attributes | [GHSA-jrmj-c5cx-3cw6](https://github.com/advisories/GHSA-jrmj-c5cx-3cw6) |
| `@angular/core` ≤18.2.14 | i18n XSS vulnerability | [GHSA-prjf-86w9-mfqv](https://github.com/advisories/GHSA-prjf-86w9-mfqv) |
| `@angular/compiler` ≤18.2.14 | Stored XSS via SVG/MathML | [GHSA-v4hv-rgfq-gp49](https://github.com/advisories/GHSA-v4hv-rgfq-gp49) |
| `@angular/compiler` ≤18.2.14 | XSS in i18n attribute bindings | [GHSA-g93w-mfhg-p222](https://github.com/advisories/GHSA-g93w-mfhg-p222) |
| `@angular/common` ≤19.2.15 | XSRF token leakage via protocol-relative URLs | [GHSA-58c5-g7wp-6w37](https://github.com/advisories/GHSA-58c5-g7wp-6w37) |

**Recommendation:** Plan an upgrade to Angular 19+ to resolve these framework-level XSS vulnerabilities.

### 1.3 Moderate (Remaining — Build Tools)

| Package | Vulnerability | Advisory |
|---------|--------------|----------|
| `ajv` 7.x-8.17.1 | ReDoS with `$data` option | [GHSA-2g4f-4pwh-qvx6](https://github.com/advisories/GHSA-2g4f-4pwh-qvx6) |
| `esbuild` ≤0.24.2 | Dev server request forgery | [GHSA-67mh-4wv8-2f99](https://github.com/advisories/GHSA-67mh-4wv8-2f99) |
| `webpack` 5.49-5.104 | SSRF via buildHttp | [GHSA-8fgc-7cc6-rx7x](https://github.com/advisories/GHSA-8fgc-7cc6-rx7x) |

> These are **build-time only** vulnerabilities and do not affect production deployments.

---

## 2. Code-Level Security Findings

### 2.1 🔴 HIGH — Excessive Use of `bypassSecurityTrust` (TrustPipe)

**File:** `src/app/shared/trust.pipe.ts`

The `TrustPipe` bypasses Angular's built-in XSS sanitization for **all content types** (HTML, Style, Script, URL, ResourceUrl). It is used extensively across **40+ template files** with `[innerHTML]="value | trust"`.

**Risk:** If any backend-provided content contains malicious scripts, this pipe will render them without sanitization.

**Recommendation:**
- Audit all usages of `| trust` pipe to verify content sources are trusted (server-controlled)
- Consider using Angular's `DomSanitizer.sanitize()` instead of `bypassSecurityTrust*` where possible
- Never use `| trust` with user-generated content without server-side sanitization

### 2.2 🔴 HIGH — Session Token Stored in localStorage

**File:** `src/app/core/next-request-state.ts`

Session tokens (`Session-Token`, `Session-Prefix`) are stored in `localStorage`, which is accessible to any JavaScript running on the page.

**Risk:** If an XSS vulnerability exists, an attacker can steal session tokens.

**Recommendation:**
- Migrate to `HttpOnly` + `Secure` + `SameSite=Strict` cookies for session management
- Remove the `appendAuth()` method that exposes tokens in URL query parameters

### 2.3 🟠 MEDIUM — Session Token Exposed in URLs

**File:** `src/app/core/next-request-state.ts` (lines 219-230)

The `appendAuth()` method appends session tokens to URLs as query parameters. This exposes tokens in:
- Browser history
- Server access logs
- Referrer headers
- Shared URLs

### 2.4 🟠 MEDIUM — `document.write()` Usage

**File:** `src/app/shared/api-helper.ts` (line 318)

`document.write()` is used to write content to a new popup window for identity provider flows. While the content is constructed from trusted sources (CSS variables), this pattern should be avoided.

### 2.5 🟡 LOW — No Content Security Policy (CSP)

No CSP meta tags or server headers are configured. This should be implemented at the deployment/server level.

**Recommended CSP:**
```
Content-Security-Policy:
  default-src 'self';
  script-src 'self';
  style-src 'self' 'unsafe-inline';
  img-src 'self' data: https:;
  font-src 'self';
  connect-src 'self';
  frame-ancestors 'none';
```

### 2.6 🟡 LOW — Missing Security Headers

The following headers should be set at the server/reverse proxy level:
- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(), microphone=(), geolocation=()`
- `Strict-Transport-Security: max-age=31536000; includeSubDomains`

---

## 3. Positive Security Aspects ✅

| Aspect | Status |
|--------|--------|
| No hardcoded secrets/credentials | ✅ PASS |
| No `eval()` or `new Function()` usage | ✅ PASS |
| Angular built-in template escaping | ✅ PASS |
| Centralized HTTP interceptor for auth | ✅ PASS |
| API client auto-generated from OpenAPI spec | ✅ PASS |
| Production source maps disabled | ✅ PASS |
| Output hashing for cache busting | ✅ PASS |
| Proper role-based access control guards | ✅ PASS |
| No sensitive data in git history | ✅ PASS |

---

## 4. Recommendations Summary

### Immediate Actions (This Sprint)
1. ✅ ~~Replace `xmldom` with `@xmldom/xmldom`~~ — **Done**
2. ✅ ~~Add `rel="noopener noreferrer"` to external links~~ — **Done**
3. ✅ ~~Move hardcoded URLs to environment config~~ — **Done**
4. ✅ ~~Fix `immutable` prototype pollution~~ — **Done**

### Short-Term Actions (Next Release)
5. Upgrade Angular to 19+ to fix framework XSS vulnerabilities
6. Audit all `| trust` pipe usages for untrusted content
7. Implement CSP headers at the server level
8. Migrate session storage from `localStorage` to `HttpOnly` cookies

### Long-Term Actions
9. Upgrade Bootstrap 4.6.1 → 5.x (Bootstrap 4 is EOL)
10. Remove jQuery dependency (required by Bootstrap 4 only)
11. Add unit tests for security-critical components
12. Set up automated `npm audit` in CI/CD pipeline
13. Implement Subresource Integrity (SRI) for external resources

---

## 5. Reporting Vulnerabilities

If you discover a security vulnerability in this project, please report it responsibly:
- **Do not** open a public GitHub issue
- Contact the maintainers directly via email
- Provide detailed steps to reproduce the vulnerability
- Allow reasonable time for a fix before public disclosure
