# Amazon Clone REST API

A simple Node.js + Express REST API for an Amazon clone, built with TypeScript, Drizzle ORM, Postgres, and Clerk authentication. Designed for use with a React Native frontend.

## Features
- User authentication with Clerk
- REST endpoints for articles and orders
- Webhook endpoint for Clerk user creation
- PostgreSQL database with Drizzle ORM
- TypeScript and live reload for development

## Prerequisites
- Node.js (v18+ recommended)
- PostgreSQL (local or remote)
- Clerk account (for authentication)

## Installation
```bash
npm install
```

## Environment Variables
Copy `.env.example` to `.env` and fill in your values:
```
DATABASE_URL=postgres://user:password@localhost:5432/amazon_clone
CLERK_SECRET_KEY=your-clerk-secret-key
CLERK_PUBLISHABLE_KEY=your-clerk-publishable-key
CLERK_JWT_KEY=
STRIPE_SECRET_KEY=
STRIPE_PUBLISHABLE_KEY=
```

## Running the Server
- Development (with live reload):
  ```bash
  npm run dev
  ```
- Production:
  ```bash
  npm run build && npm start
  ```

## Database Migrations
To generate and apply migrations, use:

```bash
npm run migrate:generate # Generate migration files from schema
npm run migrate:push     # Apply migrations to your database
```

Make sure your DATABASE_URL is set in your .env file before running migrations.

## API Endpoints
### Health Check
- `GET /health` — Returns `{ status: 'ok' }`

### Articles
- `GET /articles` — List all articles
- `GET /articles/:id` — Get a single article by ID
- `POST /articles` — Create a new article (with optional image upload)
- `PATCH /articles/:id` — Update an article
- `DELETE /articles/:id` — Delete an article
- `GET /articles/image/:imageUrl` — Serve an article image by filename
- `GET /articles/glb/:glbUrl` — Serve a GLB file by filename

### Orders
- `POST /orders/payment-sheet` — Create a Stripe payment sheet (for mobile payments)
- `GET /orders` — List orders for the authenticated user
- `GET /orders/all` — List all orders (admin, no auth)
- `GET /orders/:id` — Get a specific order by ID
- `POST /orders` — Create a new order (authenticated user)
- `PATCH /orders/:id` — Update an order (e.g., items or status)

### Clerk Webhook
- `POST /webhooks/clerk` — Handles Clerk user creation events

## Attribution

Playstation GLB from https://sketchfab.com/3d-models/ps5-d788de3735964151a3e24fd59c0f1956