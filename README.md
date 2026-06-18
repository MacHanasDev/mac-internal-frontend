# Mac Internal Frontend

Standalone Next.js app for internal organization modules. The first module is the HR workspace.

## Local Run

```bash
npm install
npm run dev
```

Open `http://localhost:3001/hr`.

The browser should call the same-origin `/api/backend/*` proxy. The proxy forwards requests to the backend URL configured in `.env.local`.
The checked-in local default points that proxy to `http://localhost:8080/api/v1`.

## Vercel

Vercel deployments should still expose `/api/backend/*` to the browser; the server-side proxy forwards to the Google Cloud backend:

```bash
https://connectors.machanas.com/api/v1
```

Do not set `NEXT_PUBLIC_INTERNAL_API_BASE` to the backend origin in Vercel. Leave it unset or set it to `/api/backend` so refresh cookies remain same-origin with the frontend.
