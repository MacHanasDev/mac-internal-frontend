# Mac Internal Frontend

Standalone Next.js app for internal organization modules. The first module is the HR workspace.

## Local Run

```bash
npm install
npm run dev
```

Open `http://localhost:3001/hr`.

The app proxies API requests through `/api/backend/*` to the backend URL configured in `.env.local`.
The checked-in local default points to `http://localhost:8080/api/v1`.

## Vercel

Vercel deployments use the Google Cloud backend directly:

```bash
https://connectors.machanas.com/api/v1
```

Local development uses `.env.local` when present and otherwise falls back to `http://localhost:8080/api/v1`.
