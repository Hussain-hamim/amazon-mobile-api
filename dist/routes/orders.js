"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const db_1 = require("../db");
const schema_1 = require("../db/schema");
const drizzle_orm_1 = require("drizzle-orm");
const express_2 = require("@clerk/express");
const stripe_1 = __importDefault(require("stripe"));
const router = (0, express_1.Router)();
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const stripe = new stripe_1.default(process.env.STRIPE_SECRET_KEY);
router.post('/payment-sheet', async (req, res) => {
    const { amount, currency, email } = req.body;
    // Use an existing Customer ID if this is a returning customer.
    const customer = await stripe.customers.create({
        email,
    });
    const ephemeralKey = await stripe.ephemeralKeys.create({ customer: customer.id }, { apiVersion: '2025-04-30.basil' });
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
        publishableKey: process.env.STRIPE_PUBLISHABLE_KEY,
    });
});
// GET /orders - list orders for authenticated user (with items)
router.get('/', (0, express_2.clerkMiddleware)(), async (req, res) => {
    const { userId: clerkUserId } = req.auth;
    if (!clerkUserId) {
        res.status(401).json({ error: 'Could not find user' });
        return;
    }
    // 1. Find the internal user ID based on the Clerk user ID
    const [user] = await db_1.db.select().from(schema_1.users).where((0, drizzle_orm_1.eq)(schema_1.users.clerkUserId, clerkUserId));
    if (!user) {
        res.status(404).json({ error: 'User not found' });
        return;
    }
    // 2. Use the internal user ID to fetch orders
    const userOrders = await db_1.db.select().from(schema_1.orders).where((0, drizzle_orm_1.eq)(schema_1.orders.userId, user.id));
    const orderIds = userOrders.map((o) => o.id);
    let items = orderIds.length
        ? await db_1.db.select().from(schema_1.orderItems).where((0, drizzle_orm_1.inArray)(schema_1.orderItems.orderId, orderIds))
        : [];
    // Fetch all articleIds for these items
    const articleIds = items.map((i) => i.articleId);
    const articlesMap = articleIds.length
        ? (await db_1.db.select().from(schema_1.articles).where((0, drizzle_orm_1.inArray)(schema_1.articles.id, articleIds))).reduce((acc, article) => {
            acc[article.id] = article;
            return acc;
        }, {})
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
    res.json(userOrders.map((order) => ({
        ...order,
        items: items.filter((i) => i.orderId === order.id),
    })));
});
// GET /orders/all - list all orders (admin, no auth for now)
router.get('/all', async (_req, res) => {
    const allOrders = await db_1.db.select().from(schema_1.orders);
    const orderIds = allOrders.map((o) => o.id);
    const items = orderIds.length
        ? await db_1.db.select().from(schema_1.orderItems).where((0, drizzle_orm_1.inArray)(schema_1.orderItems.orderId, orderIds))
        : [];
    res.json(allOrders.map((order) => ({
        ...order,
        items: items.filter((i) => i.orderId === order.id),
    })));
});
// GET /orders/:id - get a specific order by ID (no auth)
router.get('/:id', async (req, res) => {
    const orderId = Number(req.params.id);
    if (isNaN(orderId)) {
        res.status(400).json({ error: 'Invalid order id' });
        return;
    }
    // Fetch the order
    const [order] = await db_1.db.select().from(schema_1.orders).where((0, drizzle_orm_1.eq)(schema_1.orders.id, orderId));
    if (!order) {
        res.status(404).json({ error: 'Order not found' });
        return;
    }
    // Fetch items for this order
    const items = await db_1.db.select().from(schema_1.orderItems).where((0, drizzle_orm_1.eq)(schema_1.orderItems.orderId, orderId));
    // Fetch all articleIds for these items
    const articleIds = items.map((i) => i.articleId);
    const articlesMap = articleIds.length
        ? (await db_1.db.select().from(schema_1.articles).where((0, drizzle_orm_1.inArray)(schema_1.articles.id, articleIds))).reduce((acc, article) => {
            acc[article.id] = article;
            return acc;
        }, {})
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
router.post('/', (0, express_2.clerkMiddleware)(), async (req, res) => {
    const { userId: clerkUserId } = req.auth;
    if (!clerkUserId) {
        res.status(401).json({ error: 'Could not find user' });
        return;
    }
    // 1. Find the internal user ID based on the Clerk user ID
    const [user] = await db_1.db.select().from(schema_1.users).where((0, drizzle_orm_1.eq)(schema_1.users.clerkUserId, clerkUserId));
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
    const [order] = await db_1.db.insert(schema_1.orders).values({ userId }).returning();
    // Create order items
    const orderItemsToInsert = items.map((item) => ({
        orderId: order.id,
        articleId: item.articleId,
        quantity: item.quantity,
    }));
    await db_1.db.insert(schema_1.orderItems).values(orderItemsToInsert);
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
        await db_1.db.delete(schema_1.orderItems).where((0, drizzle_orm_1.eq)(schema_1.orderItems.orderId, orderId));
        // Insert new items
        const orderItemsToInsert = items.map((item) => ({
            orderId,
            articleId: item.articleId,
            quantity: item.quantity,
        }));
        await db_1.db.insert(schema_1.orderItems).values(orderItemsToInsert);
    }
    // Optionally update other order fields here
    const updatedOrder = await db_1.db.select().from(schema_1.orders).where((0, drizzle_orm_1.eq)(schema_1.orders.id, orderId));
    const updatedItems = await db_1.db.select().from(schema_1.orderItems).where((0, drizzle_orm_1.eq)(schema_1.orderItems.orderId, orderId));
    res.json({ ...updatedOrder[0], items: updatedItems });
});
exports.default = router;
