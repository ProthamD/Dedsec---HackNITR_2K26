const fs = require('fs');
const path = require('path');

const generateData = () => {
  const categories = ['Smartphones', 'Audio', 'Power', 'Wearables'];
  const marketSignals = ['Stable', 'Trending High', 'Declining', 'Viral (Social Media)', 'Holiday Peak'];
  
  const products = [
    { name: 'Gemini Phone Pro', cat: 'Smartphones', cost: 700, price: 1100 },
    { name: 'Sonic Buds', cat: 'Audio', cost: 40, price: 99 },
    { name: 'Ultra Charge 65W', cat: 'Power', cost: 15, price: 39 },
    { name: 'Zen Watch', cat: 'Wearables', cost: 150, price: 299 },
    { name: 'Power Bank 20k', cat: 'Power', cost: 25, price: 59 }
  ];

  const inventory = [];

  for (let i = 0; i < 25; i++) {
    const template = products[i % products.length];
    const stock = Math.floor(Math.random() * 100);
    const dailySales = (Math.random() * 15 + 2).toFixed(1);
    
    inventory.push({
      id: `sku-${1000 + i}`,
      name: `${template.name} ${String.fromCharCode(65 + (i % 5))}`, // Variation A, B, C...
      category: template.cat,
      current_stock: stock,
      avg_daily_sales: parseFloat(dailySales),
      unit_cost: template.cost,
      selling_price: template.price,
      lead_time_days: Math.floor(Math.random() * 5) + 2,
      storage_space_per_unit: (Math.random() * 0.5 + 0.1).toFixed(2), // cubic meters
      market_signal: marketSignals[Math.floor(Math.random() * marketSignals.length)],
      supplier_reliability: (Math.random() * 0.4 + 0.6).toFixed(2), // 0.6 to 1.0
      tags: i % 7 === 0 ? ["high-risk", "promo-eligible"] : ["standard"]
    });
  }

  // Ensure the directory exists
  const dir = path.join(__dirname, 'data');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  fs.writeFileSync(path.join(dir, 'inventory.json'), JSON.stringify(inventory, null, 2));
  console.log(`Success! Generated 25 products in src/data/inventory.json`);
};

generateData();