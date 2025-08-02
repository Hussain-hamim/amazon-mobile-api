"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const articles_1 = __importDefault(require("./routes/articles"));
const orders_1 = __importDefault(require("./routes/orders"));
const webhooks_1 = __importDefault(require("./routes/webhooks"));
const path_1 = __importDefault(require("path"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
// const clerkClient = createClerkClient({
//   secretKey: process.env.CLERK_SECRET_KEY,
//   publishableKey: process.env.CLERK_PUBLISHABLE_KEY,
// });
const app = (0, express_1.default)();
app.use((0, cors_1.default)());
app.use(express_1.default.json());
// app.use(clerkMiddleware({ clerkClient, jwtKey: process.env.CLERK_JWT_KEY }));
// Health check
app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
});
app.use('/articles', articles_1.default);
app.use('/orders', orders_1.default);
app.use('/webhooks', webhooks_1.default);
app.use('/uploads', express_1.default.static(path_1.default.join(__dirname, '../uploads')));
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Server listening on port ${PORT}`);
});
