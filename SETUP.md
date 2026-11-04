# Catelle Ningha personal website

This is a separate Vite/React project under `catelle-site/`; the original Anansi project remains untouched.

## Local preview

```bash
cd catelle-site
npm install
npm run dev
```

The public site supports all requested listing and detail URL patterns, mobile navigation, search/filtering, breadcrumbs, metadata-ready page structure, contact flow, privacy page, 404 page and an `/admin` draft workspace.

## Content and database isolation

The frontend ships with a typed content model and draft/public status. It does not import participant data or write to the existing Anansi database. Production should use the separate logical database named in `.env.example` (or clearly prefixed collections), dedicated credentials, server-side authentication/authorisation and private object storage for approved documents.

Before production, connect `/admin` to server endpoints protected by `ADMIN_TOKEN` or an existing secure auth provider. Validate uploads by MIME type and size, scan them, redact sensitive information, and keep admin routes out of indexing.

## Verification

Run `npm run typecheck` and `npm run build`. `CONTENT-CHECKLIST.md` lists the records that must be verified before replacing draft shells with public content.
