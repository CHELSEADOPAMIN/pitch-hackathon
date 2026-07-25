import { loadServerConfig } from "../config/server-config.js";
import { createDatabase } from "./client.js";
import { merchants, products } from "./schema.js";

const merchant = { id: "merchant_demo", name: "Pinch Voice Demo Store" };
const catalog = [
  ["product_coke", "Coca-Cola Classic 600ml", 450, "Red label cola bottle"],
  [
    "product_pepsi",
    "Pepsi Max 600ml",
    420,
    "Black label sugar-free cola bottle",
  ],
  [
    "product_oak",
    "OAK Chocolate Milk 600ml",
    480,
    "Brown chocolate flavoured milk carton",
  ],
  [
    "product_devondale",
    "Devondale Full Cream Milk 1L",
    320,
    "Blue full cream milk carton",
  ],
  [
    "product_water",
    "Mount Franklin Still Water 600ml",
    300,
    "Clear still water bottle",
  ],
  ["product_timtam", "Tim Tam Original 200g", 500, "Chocolate biscuit packet"],
  [
    "product_smiths",
    "Smith's Original Crinkle Cut 170g",
    550,
    "Original potato chips",
  ],
  [
    "product_redbull",
    "Red Bull Energy Drink 250ml",
    460,
    "Silver and blue energy drink can",
  ],
] as const;

const seed = async () => {
  const config = loadServerConfig();
  const database = createDatabase(config.databaseUrl);
  try {
    await database.db
      .insert(merchants)
      .values(merchant)
      .onConflictDoUpdate({
        target: merchants.id,
        set: { name: merchant.name },
      });
    for (const [id, name, priceCents, description] of catalog) {
      await database.db
        .insert(products)
        .values({ id, merchantId: merchant.id, name, priceCents, description })
        .onConflictDoUpdate({
          target: products.id,
          set: { name, priceCents, description },
        });
    }
  } finally {
    await database.close();
  }
};

await seed();
