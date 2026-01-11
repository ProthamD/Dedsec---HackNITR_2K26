const mongoose = require('mongoose');
const Inventory = require('./models/inventory');
const fs = require('fs');
const path = require('path');

// Connect to MongoDB
mongoose.connect('mongodb://127.0.0.1:27017/inventree')
  .then(async () => {
    console.log('Connected to MongoDB');
    
    // Check current count
    const currentCount = await Inventory.countDocuments();
    console.log(`\nCurrent inventory items: ${currentCount}`);
    
    if (currentCount > 0) {
      const existing = await Inventory.find({}).select('sku name userId');
      console.log('\nExisting items:');
      existing.forEach(item => {
        console.log(`  - ${item.sku}: ${item.name} (userId: ${item.userId})`);
      });
      
      console.log('\n⚠️  Database already has items. Do you want to:');
      console.log('1. Keep existing items and add new ones');
      console.log('2. Clear all and import fresh');
      console.log('\nRun with --clear flag to clear existing data first');
      
      if (!process.argv.includes('--clear')) {
        process.exit(0);
      }
      
      console.log('\n🗑️  Clearing existing inventory...');
      await Inventory.deleteMany({});
      console.log('✅ Cleared!');
    }
    
    // Read inventory.json from Inventree folder
    const jsonPath = path.join(__dirname, '../Inventree/src/data/inventory.json');
    const inventoryData = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
    
    console.log(`\n📦 Found ${inventoryData.length} items to import`);
    
    // Add userId to each item
    const itemsToInsert = inventoryData.map(item => ({
      ...item,
      userId: 'user123'
    }));
    
    // Insert into MongoDB
    await Inventory.insertMany(itemsToInsert);
    
    console.log(`\n✅ Successfully imported ${itemsToInsert.length} items!`);
    
    // Verify
    const finalCount = await Inventory.countDocuments({ userId: 'user123' });
    console.log(`\n📊 Total items in database: ${finalCount}`);
    
    const sample = await Inventory.find({ userId: 'user123' }).limit(5).select('sku name onHand');
    console.log('\nSample items:');
    sample.forEach(item => {
      console.log(`  - ${item.sku}: ${item.name} (Stock: ${item.onHand})`);
    });
    
    mongoose.connection.close();
    process.exit(0);
  })
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });
