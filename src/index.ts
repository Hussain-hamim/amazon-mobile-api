import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import articlesRouter from './routes/articles';
import ordersRouter from './routes/orders';
import webhooksRouter from './routes/webhooks';
import path from 'path';
import { clerkMiddleware, createClerkClient } from '@clerk/express';
import dotenv from 'dotenv';
dotenv.config();

// const clerkClient = createClerkClient({
//   secretKey: process.env.CLERK_SECRET_KEY,
//   publishableKey: process.env.CLERK_PUBLISHABLE_KEY,
// });

const app = express();
app.use(cors());
app.use(express.json());
// app.use(clerkMiddleware({ clerkClient, jwtKey: process.env.CLERK_JWT_KEY }));

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use('/articles', articlesRouter);
app.use('/orders', ordersRouter);
app.use('/webhooks', webhooksRouter);
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server listening on port ${PORT}`);
});
