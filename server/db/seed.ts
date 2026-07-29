import type { Database } from './client';
import { merchants, products } from './schema';

export const DEMO_MERCHANT = {
  id: 'merchant_demo',
  name: 'Pinch Voice Demo Store',
};

export const DEMO_PRODUCTS = [
  {
    id: 'product_coke',
    merchantId: DEMO_MERCHANT.id,
    name: 'Coca-Cola Classic 600ml',
    priceCents: 450,
    description: 'Red label cola bottle',
  },
  {
    id: 'product_devondale',
    merchantId: DEMO_MERCHANT.id,
    name: 'Devondale Full Cream Milk 1L',
    priceCents: 320,
    description: 'Blue full cream milk carton',
  },
  {
    id: 'product_oak',
    merchantId: DEMO_MERCHANT.id,
    name: 'OAK Chocolate Milk 600ml',
    priceCents: 480,
    description: 'Brown chocolate flavoured milk carton',
  },
  {
    id: 'product_pepsi',
    merchantId: DEMO_MERCHANT.id,
    name: 'Pepsi Max 600ml',
    priceCents: 420,
    description: 'Black label sugar-free cola bottle',
  },
  {
    id: 'product_redbull',
    merchantId: DEMO_MERCHANT.id,
    name: 'Red Bull Energy Drink 250ml',
    priceCents: 460,
    description: 'Silver and blue energy drink can',
  },
  {
    id: 'product_smiths',
    merchantId: DEMO_MERCHANT.id,
    name: "Smith's Original Crinkle Cut 170g",
    priceCents: 550,
    description: 'Original potato chips',
  },
  {
    id: 'product_timtam',
    merchantId: DEMO_MERCHANT.id,
    name: 'Tim Tam Original 200g',
    priceCents: 500,
    description: 'Chocolate biscuit packet',
  },
  {
    id: 'product_water',
    merchantId: DEMO_MERCHANT.id,
    name: 'Mount Franklin Still Water 600ml',
    priceCents: 300,
    description: 'Clear still water bottle',
  },
  {
    id: 'product_kleenex_tissues',
    merchantId: DEMO_MERCHANT.id,
    name: 'Kleenex Everyday Facial Tissues 95 Pack',
    priceCents: 350,
    description: 'Blue and white rectangular facial tissue box',
  },
  {
    id: 'product_viva_paper_towel',
    merchantId: DEMO_MERCHANT.id,
    name: 'VIVA Select-A-Size Paper Towel 2 Pack',
    priceCents: 650,
    description: 'White twin roll pack with blue VIVA branding',
  },
  {
    id: 'product_colgate',
    merchantId: DEMO_MERCHANT.id,
    name: 'Colgate Total Original Toothpaste 115g',
    priceCents: 490,
    description: 'Red and white rectangular toothpaste box',
  },
  {
    id: 'product_dettol_sanitiser',
    merchantId: DEMO_MERCHANT.id,
    name: 'Dettol Instant Hand Sanitiser 50ml',
    priceCents: 380,
    description: 'Small clear bottle with a green Dettol label',
  },
  {
    id: 'product_dove_soap',
    merchantId: DEMO_MERCHANT.id,
    name: 'Dove Beauty Cream Bar 100g',
    priceCents: 250,
    description: 'White soap box with a blue Dove logo',
  },
  {
    id: 'product_oreo',
    merchantId: DEMO_MERCHANT.id,
    name: 'Oreo Original 133g',
    priceCents: 300,
    description: 'Blue packet of chocolate sandwich biscuits',
  },
  {
    id: 'product_doritos',
    merchantId: DEMO_MERCHANT.id,
    name: 'Doritos Cheese Supreme 170g',
    priceCents: 550,
    description: 'Bright orange bag of cheese tortilla chips',
  },
  {
    id: 'product_shapes',
    merchantId: DEMO_MERCHANT.id,
    name: "Arnott's Shapes Barbecue 175g",
    priceCents: 450,
    description: 'Red and yellow rectangular savoury cracker box',
  },
  {
    id: 'product_kitkat',
    merchantId: DEMO_MERCHANT.id,
    name: 'KitKat 4 Finger Milk Chocolate 45g',
    priceCents: 250,
    description: 'Small red chocolate bar wrapper with a white KitKat logo',
  },
  {
    id: 'product_upandgo',
    merchantId: DEMO_MERCHANT.id,
    name: 'Sanitarium Up&Go Chocolate 250ml',
    priceCents: 320,
    description: 'Small brown and white breakfast drink carton',
  },
  {
    id: 'product_nescafe',
    merchantId: DEMO_MERCHANT.id,
    name: 'Nescafé Blend 43 Instant Coffee 140g',
    priceCents: 1000,
    description: 'Dark brown glass coffee jar with a red lid',
  },
  {
    id: 'product_bread',
    merchantId: DEMO_MERCHANT.id,
    name: 'Tip Top The One White Bread 700g',
    priceCents: 400,
    description: 'White bread loaf in a blue and red plastic bag',
  },
  {
    id: 'product_cripps_shortbread',
    merchantId: DEMO_MERCHANT.id,
    name: 'Cripps Premium Tasmanian Shortbread 200g',
    priceCents: 550,
    description:
      'Long white and grey box with a Tasmanian coastal photo, gold Shortbread script and Cripps logo',
  },
  {
    id: 'product_pureau_water',
    merchantId: DEMO_MERCHANT.id,
    name: "Pureau Australia's Purest Water 2L",
    priceCents: 250,
    description:
      'Large clear 2 litre water bottle with a pale blue label and bright blue Pureau wordmark',
  },
  {
    id: 'product_nice_natural_trail_mix',
    merchantId: DEMO_MERCHANT.id,
    name: 'Nice & Natural Roasted Nut Bars Trail Mix 6 Pack 192g',
    priceCents: 500,
    description:
      'Red box containing six roasted nut trail mix bars with Nice & Natural branding',
  },
  {
    id: 'product_pistachio_papi',
    merchantId: DEMO_MERCHANT.id,
    name: 'Pistachio Papi Crunchy Pistachio Spread 180g',
    priceCents: 1400,
    description:
      '180g glass jar with a black lid and a white and green illustrated Pistachio Papi crunchy spread label',
  },
  {
    id: 'product_blackmores_omega_mental_focus',
    merchantId: DEMO_MERCHANT.id,
    name: 'Blackmores Omega + Mental Focus 60 Soft Capsules',
    priceCents: 3000,
    description:
      'Amber glass supplement bottle with a white cap and white Blackmores label, teal OMEGA band, purple MENTAL FOCUS band, and Bacopa, L-theanine and Siberian ginseng text',
  },
  {
    id: 'product_musashi_protein_crisp',
    merchantId: DEMO_MERCHANT.id,
    name: 'Musashi Protein Crisp Chocolate Bar',
    priceCents: 450,
    description:
      'Small black protein snack wrapper with red MUSASHI branding, large white PROTEIN CRISP text, and a chocolate-coated crispy bar image',
  },
  {
    id: 'product_laochenpi_dried_mandarin_peel',
    merchantId: DEMO_MERCHANT.id,
    name: 'Haoyunlai Lao Chen Pi Dried Mandarin Peel',
    priceCents: 350,
    description:
      'Peach and tan Chinese snack pouch with large dark red 老陈皮 text, 好运来食品 branding, LAOCHENPI text, and a clear window showing dark dried mandarin peel',
  },
  {
    id: 'product_nin_jiom_super_mint',
    merchantId: DEMO_MERCHANT.id,
    name: 'Nin Jiom Herbal Candy Super Mint',
    priceCents: 590,
    description:
      'Round blue and cream Nin Jiom herbal candy tin with a red centre label, green leaf pattern, and Herbal Candy Super Mint text',
  },
  {
    id: 'product_walkers_shortbread_fingers',
    merchantId: DEMO_MERCHANT.id,
    name: "Walker's Shortbread Fingers 150g",
    priceCents: 550,
    description:
      "Tall red tartan Walker's box with a cream label, black WALKER'S SHORTBREAD FINGERS text, and pictures of rectangular golden shortbread biscuits",
  },
] as const;

export async function seedDatabase(db: Database) {
  await db
    .insert(merchants)
    .values(DEMO_MERCHANT)
    .onConflictDoUpdate({
      target: merchants.id,
      set: { name: DEMO_MERCHANT.name },
    });

  for (const product of DEMO_PRODUCTS) {
    await db
      .insert(products)
      .values(product)
      .onConflictDoUpdate({
        target: products.id,
        set: {
          merchantId: product.merchantId,
          name: product.name,
          priceCents: product.priceCents,
          description: product.description,
        },
      });
  }
}
