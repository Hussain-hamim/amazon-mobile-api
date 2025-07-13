import { db } from '../src/db';
import { articles } from '../src/db/schema';
import fs from 'fs';
import path from 'path';

async function main() {
  const filePath = path.join(__dirname, '../assets/products/dummy_items.json');
  const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

  for (const item of data) {
    await db.insert(articles).values({
      title: item.title,
      description: item.description,
      price: Math.round(item.price), // articles.price is integer
      imageUrl: item.image || null,
      glbUrl: item.glb || null,
      // createdAt will default to now
    });
  }
  console.log('Import complete!');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
