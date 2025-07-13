import { Router } from 'express';
import { db } from '../db';
import { orders, orderItems, articles, users } from '../db/schema';
import { eq, and, inArray } from 'drizzle-orm';
import { clerkMiddleware, getAuth, requireAuth } from '@clerk/express';
import Stripe from 'stripe';

const router = Router();
import dotenv from 'dotenv';
dotenv.config();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

router.post('/payment-sheet', async (req, res) => {
  const { amount, currency, email } = req.body;
  // Use an existing Customer ID if this is a returning customer.
  const customer = await stripe.customers.create({
    email,
  });
  const ephemeralKey = await stripe.ephemeralKeys.create(
    { customer: customer.id },
    { apiVersion: '2025-04-30.basil' }
  );
  const paymentIntent = await stripe.paymentIntents.create({
    amount: amount * 100,
    currency,
    customer: customer.id,
    // In the latest version of the API, specifying the `automatic_payment_methods` parameter
    // is optional because Stripe enables its functionality by default.
    automatic_payment_methods: {
      enabled: true,
    },
  });

  res.json({
    paymentIntent: paymentIntent.client_secret,
    ephemeralKey: ephemeralKey.secret,
    customer: customer.id,
    publishableKey: process.env.STRIPE_PUBLISHABLE_KEY!,
  });
});

// GET /orders - list orders for authenticated user (with items)
router.get('/', clerkMiddleware(), async (req: any, res) => {
  const { userId: clerkUserId } = req.auth;

  if (!clerkUserId) {
    res.status(401).json({ error: 'Could not find user' });
    return;
  }

  // 1. Find the internal user ID based on the Clerk user ID
  const [user] = await db.select().from(users).where(eq(users.clerkUserId, clerkUserId));
  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  // 2. Use the internal user ID to fetch orders
  const userOrders = await db.select().from(orders).where(eq(orders.userId, user.id));
  const orderIds = userOrders.map((o) => o.id);
  let items = orderIds.length
    ? await db.select().from(orderItems).where(inArray(orderItems.orderId, orderIds))
    : [];

  // Fetch all articleIds for these items
  const articleIds = items.map((i) => i.articleId);
  const articlesMap = articleIds.length
    ? (await db.select().from(articles).where(inArray(articles.id, articleIds))).reduce(
        (acc, article) => {
          acc[article.id] = article;
          return acc;
        },
        {} as Record<number, any>
      )
    : {};

  // Attach full article info to each item, mapping imageUrl and glbUrl to full URLs
  const host = req.get('host');
  const protocol = req.protocol;
  items = items.map((item) => {
    let article = articlesMap[item.articleId] || null;
    if (article) {
      article = {
        ...article,
        imageUrl: article.imageUrl
          ? `${protocol}://${host}/articles/image/${encodeURIComponent(article.imageUrl)}`
          : null,
        glbUrl: article.glbUrl
          ? `${protocol}://${host}/articles/glb/${encodeURIComponent(article.glbUrl)}`
          : null,
      };
    }
    return {
      ...item,
      article,
    };
  });

  res.json(
    userOrders.map((order) => ({
      ...order,
      items: items.filter((i) => i.orderId === order.id),
    }))
  );
});

// GET /orders/all - list all orders (admin, no auth for now)
router.get('/all', async (_req, res) => {
  const allOrders = await db.select().from(orders);
  const orderIds = allOrders.map((o) => o.id);
  const items = orderIds.length
    ? await db.select().from(orderItems).where(inArray(orderItems.orderId, orderIds))
    : [];
  res.json(
    allOrders.map((order) => ({
      ...order,
      items: items.filter((i) => i.orderId === order.id),
    }))
  );
});

// GET /orders/:id - get a specific order by ID (no auth)
router.get('/:id', async (req, res) => {
  const orderId = Number(req.params.id);
  if (isNaN(orderId)) {
    res.status(400).json({ error: 'Invalid order id' });
    return;
  }
  // Fetch the order
  const [order] = await db.select().from(orders).where(eq(orders.id, orderId));
  if (!order) {
    res.status(404).json({ error: 'Order not found' });
    return;
  }
  // Fetch items for this order
  const items = await db.select().from(orderItems).where(eq(orderItems.orderId, orderId));

  // Fetch all articleIds for these items
  const articleIds = items.map((i) => i.articleId);
  const articlesMap = articleIds.length
    ? (await db.select().from(articles).where(inArray(articles.id, articleIds))).reduce(
        (acc, article) => {
          acc[article.id] = article;
          return acc;
        },
        {} as Record<number, any>
      )
    : {};

  // Attach full article info to each item, mapping imageUrl and glbUrl to full URLs
  const host = req.get('host');
  const protocol = req.protocol;
  const itemsWithArticles = items.map((item) => {
    let article = articlesMap[item.articleId] || null;
    if (article) {
      article = {
        ...article,
        imageUrl: article.imageUrl
          ? `${protocol}://${host}/articles/image/${encodeURIComponent(article.imageUrl)}`
          : null,
        glbUrl: article.glbUrl
          ? `${protocol}://${host}/articles/glb/${encodeURIComponent(article.glbUrl)}`
          : null,
      };
    }
    return {
      ...item,
      article,
    };
  });

  res.json({ ...order, items: itemsWithArticles });
});

// POST /orders - create new order with items for authenticated user
router.post('/', clerkMiddleware(), async (req: any, res) => {
  const { userId: clerkUserId } = req.auth;

  if (!clerkUserId) {
    res.status(401).json({ error: 'Could not find user' });
    return;
  }

  // 1. Find the internal user ID based on the Clerk user ID
  const [user] = await db.select().from(users).where(eq(users.clerkUserId, clerkUserId));
  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }
  const userId = user.id;

  const { items } = req.body; // items: [{ articleId, quantity }]
  if (!Array.isArray(items) || items.length === 0) {
    res.status(400).json({ error: 'Missing or invalid items' });
    return;
  }
  // Create order
  const [order] = await db.insert(orders).values({ userId }).returning();
  // Create order items
  const orderItemsToInsert = items.map((item: any) => ({
    orderId: order.id,
    articleId: item.articleId,
    quantity: item.quantity,
  }));
  await db.insert(orderItems).values(orderItemsToInsert);
  res.status(201).json({ ...order, items: orderItemsToInsert });
});

// PATCH /orders/:id - update order (e.g., items or status)
router.patch('/:id', async (req, res) => {
  const orderId = Number(req.params.id);
  if (isNaN(orderId)) {
    res.status(400).json({ error: 'Invalid order id' });
    return;
  }
  const { items } = req.body; // items: [{ articleId, quantity }]
  // Optionally update items
  if (Array.isArray(items)) {
    // Delete old items
    await db.delete(orderItems).where(eq(orderItems.orderId, orderId));
    // Insert new items
    const orderItemsToInsert = items.map((item: any) => ({
      orderId,
      articleId: item.articleId,
      quantity: item.quantity,
    }));
    await db.insert(orderItems).values(orderItemsToInsert);
  }
  // Optionally update other order fields here
  const updatedOrder = await db.select().from(orders).where(eq(orders.id, orderId));
  const updatedItems = await db.select().from(orderItems).where(eq(orderItems.orderId, orderId));
  res.json({ ...updatedOrder[0], items: updatedItems });
});

export default router;
