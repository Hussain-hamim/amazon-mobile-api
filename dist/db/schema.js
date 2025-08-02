"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.orderItems = exports.orders = exports.articles = exports.users = void 0;
const pg_core_1 = require("drizzle-orm/pg-core");
exports.users = (0, pg_core_1.pgTable)('users', {
    id: (0, pg_core_1.serial)('id').primaryKey(),
    clerkUserId: (0, pg_core_1.varchar)('clerk_user_id', { length: 255 }).notNull().unique(),
    email: (0, pg_core_1.varchar)('email', { length: 255 }).notNull(),
    createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow().notNull(),
});
exports.articles = (0, pg_core_1.pgTable)('articles', {
    id: (0, pg_core_1.serial)('id').primaryKey(),
    title: (0, pg_core_1.varchar)('title', { length: 255 }).notNull(),
    description: (0, pg_core_1.text)('description'),
    price: (0, pg_core_1.integer)('price').notNull(),
    imageUrl: (0, pg_core_1.varchar)('image_url', { length: 255 }),
    glbUrl: (0, pg_core_1.varchar)('glb_url', { length: 255 }),
    createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow().notNull(),
});
exports.orders = (0, pg_core_1.pgTable)('orders', {
    id: (0, pg_core_1.serial)('id').primaryKey(),
    userId: (0, pg_core_1.integer)('user_id')
        .notNull()
        .references(() => exports.users.id),
    createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow().notNull(),
    status: (0, pg_core_1.varchar)('status', { length: 255 }).notNull().default('pending'),
});
exports.orderItems = (0, pg_core_1.pgTable)('order_items', {
    id: (0, pg_core_1.serial)('id').primaryKey(),
    orderId: (0, pg_core_1.integer)('order_id')
        .notNull()
        .references(() => exports.orders.id),
    articleId: (0, pg_core_1.integer)('article_id')
        .notNull()
        .references(() => exports.articles.id),
    quantity: (0, pg_core_1.integer)('quantity').notNull(),
    createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow().notNull(),
});
