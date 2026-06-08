# Mac Internal Frontend

Standalone Next.js app for internal organization modules. The first module is the HR workspace.

## Local Run

```bash
npm install
npm run dev
```

Open `http://localhost:3001/hr`.

The app proxies API requests through `/api/backend/*` to the backend URL configured in `.env.local`.
