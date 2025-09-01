// Script to populate device colors from GSMArena dataset
import { db } from '../server/db';
import { deviceColors } from '../shared/schema';

// Sample device color data extracted from GSMArena dataset
const deviceColorData = [
  // Apple devices
  { deviceType: 'Phone', brand: 'Apple', model: 'iPhone 15 Pro', colors: ['Natural Titanium', 'Blue Titanium', 'White Titanium', 'Black Titanium'] },
  { deviceType: 'Phone', brand: 'Apple', model: 'iPhone 15', colors: ['Black', 'Blue', 'Green', 'Yellow', 'Pink'] },
  { deviceType: 'Phone', brand: 'Apple', model: 'iPhone 14 Pro', colors: ['Deep Purple', 'Gold', 'Silver', 'Space Black'] },
  { deviceType: 'Phone', brand: 'Apple', model: 'iPhone 14', colors: ['Blue', 'Purple', 'Midnight', 'Starlight', 'Red'] },
  { deviceType: 'Phone', brand: 'Apple', model: 'iPhone 13 Pro', colors: ['Alpine Green', 'Gold', 'Graphite', 'Sierra Blue', 'Silver'] },
  { deviceType: 'Phone', brand: 'Apple', model: 'iPhone 13', colors: ['Pink', 'Blue', 'Midnight', 'Starlight', 'Red'] },
  { deviceType: 'Phone', brand: 'Apple', model: 'iPhone 12 Pro', colors: ['Gold', 'Graphite', 'Pacific Blue', 'Silver'] },
  { deviceType: 'Phone', brand: 'Apple', model: 'iPhone 12', colors: ['Black', 'Blue', 'Green', 'Purple', 'Red', 'White'] },
  
  // Samsung devices
  { deviceType: 'Phone', brand: 'Samsung', model: 'Galaxy S24 Ultra', colors: ['Titanium Black', 'Titanium Gray', 'Titanium Violet', 'Titanium Yellow'] },
  { deviceType: 'Phone', brand: 'Samsung', model: 'Galaxy S24+', colors: ['Cobalt Violet', 'Amber Yellow', 'Onyx Black', 'Marble Gray'] },
  { deviceType: 'Phone', brand: 'Samsung', model: 'Galaxy S24', colors: ['Onyx Black', 'Marble Gray', 'Cobalt Violet', 'Amber Yellow'] },
  { deviceType: 'Phone', brand: 'Samsung', model: 'Galaxy S23 Ultra', colors: ['Phantom Black', 'Cream', 'Green', 'Lavender'] },
  { deviceType: 'Phone', brand: 'Samsung', model: 'Galaxy S23+', colors: ['Phantom Black', 'Cream', 'Green', 'Lavender'] },
  { deviceType: 'Phone', brand: 'Samsung', model: 'Galaxy S23', colors: ['Phantom Black', 'Cream', 'Green', 'Lavender'] },
  { deviceType: 'Phone', brand: 'Samsung', model: 'Galaxy S22 Ultra', colors: ['Phantom Black', 'Phantom White', 'Burgundy', 'Green'] },
  { deviceType: 'Phone', brand: 'Samsung', model: 'Galaxy S21 Ultra', colors: ['Phantom Black', 'Phantom Silver', 'Phantom Brown', 'Phantom Navy'] },
  
  // Google Pixel devices
  { deviceType: 'Phone', brand: 'Google', model: 'Pixel 8 Pro', colors: ['Obsidian', 'Porcelain', 'Bay'] },
  { deviceType: 'Phone', brand: 'Google', model: 'Pixel 8', colors: ['Obsidian', 'Hazel', 'Rose'] },
  { deviceType: 'Phone', brand: 'Google', model: 'Pixel 7 Pro', colors: ['Obsidian', 'Snow', 'Hazel'] },
  { deviceType: 'Phone', brand: 'Google', model: 'Pixel 7', colors: ['Obsidian', 'Snow', 'Lemongrass'] },
  
  // OnePlus devices
  { deviceType: 'Phone', brand: 'OnePlus', model: 'OnePlus 12', colors: ['Silky Black', 'Flowy Emerald', 'White'] },
  { deviceType: 'Phone', brand: 'OnePlus', model: 'OnePlus 11', colors: ['Titan Black', 'Eternal Green'] },
  { deviceType: 'Phone', brand: 'OnePlus', model: 'OnePlus 10 Pro', colors: ['Volcanic Black', 'Emerald Forest', 'White'] },
  
  // Xiaomi devices
  { deviceType: 'Phone', brand: 'Xiaomi', model: 'Xiaomi 14 Ultra', colors: ['Black', 'White'] },
  { deviceType: 'Phone', brand: 'Xiaomi', model: 'Xiaomi 14 Pro', colors: ['Black', 'White', 'Green'] },
  { deviceType: 'Phone', brand: 'Xiaomi', model: 'Xiaomi 13 Pro', colors: ['Ceramic Black', 'Ceramic White', 'Flora Green'] },
  
  // Popular tablets
  { deviceType: 'Tablet', brand: 'Apple', model: 'iPad Pro 12.9-inch', colors: ['Space Gray', 'Silver'] },
  { deviceType: 'Tablet', brand: 'Apple', model: 'iPad Air', colors: ['Space Gray', 'Starlight', 'Pink', 'Purple', 'Blue'] },
  { deviceType: 'Tablet', brand: 'Apple', model: 'iPad', colors: ['Space Gray', 'Silver', 'Pink', 'Blue', 'Yellow'] },
  { deviceType: 'Tablet', brand: 'Samsung', model: 'Galaxy Tab S9 Ultra', colors: ['Beige', 'Graphite'] },
  { deviceType: 'Tablet', brand: 'Samsung', model: 'Galaxy Tab S9+', colors: ['Beige', 'Graphite'] },
  { deviceType: 'Tablet', brand: 'Samsung', model: 'Galaxy Tab S9', colors: ['Beige', 'Graphite'] },
];

async function populateDeviceColors() {
  try {
    console.log('🎨 Starting device colors population...');
    
    let insertedCount = 0;
    let skippedCount = 0;
    
    for (const deviceData of deviceColorData) {
      try {
        // Check if this device already exists
        const existing = await db.query.deviceColors.findFirst({
          where: (colors, { and, eq }) => and(
            eq(colors.deviceType, deviceData.deviceType),
            eq(colors.brand, deviceData.brand),
            eq(colors.model, deviceData.model)
          )
        });
        
        if (existing) {
          console.log(`⏭️  Skipping ${deviceData.brand} ${deviceData.model} - already exists`);
          skippedCount++;
          continue;
        }
        
        // Insert new device colors
        await db.insert(deviceColors).values({
          deviceType: deviceData.deviceType,
          brand: deviceData.brand,
          model: deviceData.model,
          colors: deviceData.colors,
          source: 'manual',
          lastUpdated: new Date(),
        });
        
        console.log(`✅ Added ${deviceData.brand} ${deviceData.model}: [${deviceData.colors.join(', ')}]`);
        insertedCount++;
        
      } catch (error) {
        console.error(`❌ Error inserting ${deviceData.brand} ${deviceData.model}:`, error);
      }
    }
    
    console.log(`\n📊 Population complete:`);
    console.log(`   ✅ Inserted: ${insertedCount} devices`);
    console.log(`   ⏭️  Skipped: ${skippedCount} devices (already existed)`);
    console.log(`   📱 Total: ${deviceColorData.length} devices processed`);
    
  } catch (error) {
    console.error('❌ Fatal error during population:', error);
    process.exit(1);
  }
}

// Run the population script
populateDeviceColors()
  .then(() => {
    console.log('🎉 Device colors population completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Device colors population failed:', error);
    process.exit(1);
  });