# Mac Internal Frontend

Standalone Next.js app for internal organization modules. The first module is the HR workspace.

## Local Run

```bash
npm install
npm run dev
```

Open `http://localhost:3001/hr`.

The app proxies API requests through `/api/backend/*` to the backend URL configured in `.env.local`.

## Vercel

Set this environment variable for Production and Preview deployments:

```bash
INTERNAL_BACKEND_API_URL=https://macproc-backend-final.fly.dev/api/v1
```

When running on Vercel without this variable, the proxy falls back to the same Fly backend URL. Local development still falls back to `http://localhost:8080/api/v1`.
