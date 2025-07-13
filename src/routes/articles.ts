import { Router } from 'express';
import { db } from '../db';
import { articles } from '../db/schema';
import multer from 'multer';
import path from 'path';
import { eq } from 'drizzle-orm';

const router = Router();

const upload = multer({
  dest: path.join(__dirname, '../../uploads'),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
});

// GET /articles - list all articles
router.get('/', async (req, res) => {
  const all = await db.select().from(articles);
  const host = req.get('host');
  const protocol = req.protocol;
  // Map imageUrl and glbUrl to full URLs if present
  const mapped = all.map((article) => ({
    ...article,
    imageUrl: article.imageUrl
      ? `${protocol}://${host}/articles/image/${encodeURIComponent(article.imageUrl)}`
      : null,
    glbUrl: article.glbUrl
      ? `${protocol}://${host}/articles/glb/${encodeURIComponent(article.glbUrl)}`
      : null,
  }));
  res.json(mapped);
});

// GET /articles/:id - get one article by id
router.get('/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: 'Invalid article id' });
    return;
  }
  const article = await db.select().from(articles).where(eq(articles.id, id));
  if (!article.length) {
    res.status(404).json({ error: 'Article not found' });
    return;
  }
  const host = req.get('host');
  const protocol = req.protocol;
  // Map imageUrl and glbUrl to full URLs if present
  const mapped = {
    ...article[0],
    imageUrl: article[0].imageUrl
      ? `${protocol}://${host}/articles/image/${encodeURIComponent(article[0].imageUrl)}`
      : null,
    glbUrl: article[0].glbUrl
      ? `${protocol}://${host}/articles/glb/${encodeURIComponent(article[0].glbUrl)}`
      : null,
  };
  res.json(mapped);
});

// PATCH /articles/:id - update article
router.patch('/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: 'Invalid article id' });
    return;
  }
  const { title, description, price, imageUrl } = req.body;
  const [updated] = await db
    .update(articles)
    .set({ title, description, price, imageUrl })
    .where(eq(articles.id, id))
    .returning();
  if (!updated) {
    res.status(404).json({ error: 'Article not found' });
    return;
  }
  res.json(updated);
});

// DELETE /articles/:id - delete article
router.delete('/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: 'Invalid article id' });
    return;
  }
  const [deleted] = await db.delete(articles).where(eq(articles.id, id)).returning();
  if (!deleted) {
    res.status(404).json({ error: 'Article not found' });
    return;
  }
  res.json({ success: true });
});

// POST /articles - create new article with image upload
router.post('/', upload.single('image'), async (req, res) => {
  const { title, description, price } = req.body;
  let imageUrl = req.body.imageUrl;
  // req.file is defined by multer
  const file = req.file as Express.Multer.File | undefined;
  if (file) {
    imageUrl = `/uploads/${file.filename}`;
  }
  if (!title || !price) {
    res.status(400).json({ error: 'Missing required fields' });
    return;
  }
  const [created] = await db
    .insert(articles)
    .values({ title, description, price, imageUrl })
    .returning();
  res.status(201).json(created);
});

// GET /articles/image/:imageUrl - serve an image by filename from assets/products
router.get('/image/:imageUrl', (req, res) => {
  const { imageUrl } = req.params;
  if (!imageUrl) {
    res.status(400).json({ error: 'Missing image filename' });
    return;
  }
  const imagePath = path.join(__dirname, '../../assets/products', path.basename(imageUrl));
  res.sendFile(imagePath, (err) => {
    if (err) {
      res.status(404).json({ error: 'Image file not found' });
    }
  });
});

// GET /articles/glb/:glbUrl - serve a glb file by filename from assets/products
router.get('/glb/:glbUrl', (req, res) => {
  const { glbUrl } = req.params;
  if (!glbUrl) {
    res.status(400).json({ error: 'Missing glb filename' });
    return;
  }
  const glbPath = path.join(__dirname, '../../assets/products', path.basename(glbUrl));
  res.sendFile(glbPath, (err) => {
    if (err) {
      res.status(404).json({ error: 'GLB file not found' });
    }
  });
});

// Note: Make sure the 'uploads' folder exists at the project root for image uploads.

export default router;
