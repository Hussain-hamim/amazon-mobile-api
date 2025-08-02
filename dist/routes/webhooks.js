"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const db_1 = require("../db");
const schema_1 = require("../db/schema");
const router = (0, express_1.Router)();
// POST /webhooks/clerk - handle Clerk user.created event
router.post('/clerk', async (req, res) => {
    const event = req.body;
    try {
        // Clerk user.created webhook payload structure
        // See: https://clerk.com/docs/reference/webhooks#user.created
        const clerkUserId = event.data?.id;
        const email = event.data?.email_addresses?.[0]?.email_address;
        if (!clerkUserId || !email) {
            res.status(400).json({ error: 'Missing Clerk user id or email in webhook payload' });
            return;
        }
        await db_1.db.insert(schema_1.users).values({ clerkUserId, email });
        res.status(201).json({ created: true });
    }
    catch (err) {
        console.error('Error handling Clerk webhook:', err);
        res.status(500).json({ error: 'Failed to create user from Clerk webhook' });
    }
});
exports.default = router;
