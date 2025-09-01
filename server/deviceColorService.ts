// @ts-ignore - No type definitions available for gsmarena-api
import gsmarena from 'gsmarena-api';
import { storage } from './storage.js';

interface DeviceColors {
  colors: string[];
  fromCache: boolean;
  source: 'database' | 'api' | 'fallback';
}

interface DeviceColorCacheEntry {
  colors: string[];
  timestamp: number;
}

class DeviceColorService {
  private cache = new Map<string, DeviceColorCacheEntry>();
  private readonly CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

  private getCacheKey(deviceType: string, brand: string, model: string): string {
    return `${deviceType.toLowerCase()}-${brand.toLowerCase()}-${model.toLowerCase()}`;
  }

  private async searchDatabaseColors(deviceType: string, brand: string, model: string): Promise<string[]> {
    try {
      console.log(`🗄️  Searching database for ${brand} ${model} (${deviceType})`);
      
      const result = await db.query.deviceColors.findFirst({
        where: and(
          eq(deviceColors.deviceType, deviceType),
          eq(deviceColors.brand, brand),
          eq(deviceColors.model, model)
        )
      });
      
      if (result && result.colors && result.colors.length > 0) {
        console.log(`🎯 Found ${result.colors.length} colors in database for ${brand} ${model}:`, result.colors);
        return result.colors;
      }
      
      console.log(`❌ No colors found in database for ${brand} ${model}`);
      return [];
    } catch (error) {
      console.error(`❌ Database error searching colors for ${brand} ${model}:`, error);
      return [];
    }
  }

  private isValidCacheEntry(entry: DeviceColorCacheEntry): boolean {
    return Date.now() - entry.timestamp < this.CACHE_DURATION;
  }

  private parseColorsFromSpecs(detailSpec: any[]): string[] {
    const colors = new Set<string>();
    
    // Look for color information in different specification categories
    for (const category of detailSpec) {
      if (category.specifications) {
        for (const spec of category.specifications) {
          const specName = spec.name?.toLowerCase() || '';
          const specValue = spec.value || '';
          
          // Look for color-related specifications
          if (specName.includes('color') || specName.includes('colours')) {
            // Parse comma-separated colors
            const colorList = specValue.split(',').map((color: string) => color.trim());
            colorList.forEach((color: string) => {
              if (color && color.length > 0) {
                colors.add(color);
              }
            });
          }
        }
      }
    }
    
    return Array.from(colors);
  }

  private async searchDeviceColors(deviceType: string, brand: string, model: string): Promise<string[]> {
    try {
      console.log(`🎨 Searching colors for ${brand} ${model} (${deviceType})`);
      
      // Search for the device
      const searchQuery = `${brand} ${model}`;
      const searchResults = await gsmarena.search.search(searchQuery);
      
      if (!searchResults || searchResults.length === 0) {
        console.log(`❌ No search results found for ${searchQuery}`);
        return [];
      }
      
      // Get the first matching device
      const device = searchResults[0];
      const deviceDetails = await gsmarena.catalog.getDevice(device.id);
      
      if (!deviceDetails || !deviceDetails.detailSpec) {
        console.log(`❌ No device details found for ${device.id}`);
        return [];
      }
      
      // Parse colors from specifications
      const colors = this.parseColorsFromSpecs(deviceDetails.detailSpec);
      console.log(`🎨 Found ${colors.length} colors for ${brand} ${model}:`, colors);
      
      return colors;
    } catch (error: any) {
      // Handle rate limiting specifically
      if (error?.response?.status === 429) {
        console.log(`⏰ Rate limited for ${brand} ${model} - API cooldown in effect`);
        return [];
      }
      
      console.error(`❌ Error searching device colors for ${brand} ${model}:`, error);
      return [];
    }
  }

  // Check if device exists in auto-gen lists
  private async isDeviceInAutoGenLists(deviceType: string, brand: string, model: string): Promise<boolean> {
    try {
      const listType = `AutoGen-List-Models-${deviceType}-${brand}`;
      const autoGenList = await storage.getAutoGenListByType(listType);
      
      if (!autoGenList || !autoGenList.items) {
        return false;
      }
      
      // Check if model exists in the items array (case-insensitive)
      const modelExists = autoGenList.items.some(item => 
        item.toLowerCase() === model.toLowerCase()
      );
      
      return modelExists;
    } catch (error) {
      console.error(`Error checking auto-gen list for ${deviceType}-${brand}-${model}:`, error);
      return false;
    }
  }

  async getDeviceColors(deviceType: string, brand: string, model: string): Promise<DeviceColors> {
    console.log(`🎨 Auto-gen list dependent lookup for ${brand} ${model} (${deviceType})`);
    
    // Step 0: Check if device exists in auto-gen lists first
    const deviceExistsInAutoGen = await this.isDeviceInAutoGenLists(deviceType, brand, model);
    
    if (!deviceExistsInAutoGen) {
      console.log(`❌ Device ${brand} ${model} (${deviceType}) not found in auto-gen lists - no colors available`);
      return {
        colors: [],
        fromCache: false
      };
    }
    
    console.log(`✅ Device ${brand} ${model} (${deviceType}) exists in auto-gen lists`);
    
    // Step 1: Check database first (fastest, most reliable)
    try {
      const dbEntry = await storage.getDeviceColors(deviceType, brand, model);
      if (dbEntry && dbEntry.colors.length > 0) {
        console.log(`💾 Found ${dbEntry.colors.length} colors in database for ${brand} ${model}:`, dbEntry.colors);
        return {
          colors: dbEntry.colors,
          fromCache: true
        };
      }
    } catch (error) {
      console.error(`❌ Database lookup failed for ${brand} ${model}:`, error);
    }
    
    // Step 2: Check memory cache (for recent API results)
    const cacheKey = this.getCacheKey(deviceType, brand, model);
    const cachedEntry = this.cache.get(cacheKey);
    if (cachedEntry && this.isValidCacheEntry(cachedEntry)) {
      console.log(`📦 Returning memory cached colors for ${brand} ${model}`);
      return {
        colors: cachedEntry.colors,
        fromCache: true
      };
    }
    
    // Step 3: Try API search (only if database doesn't have the model)
    console.log(`🌐 Trying API lookup for ${brand} ${model}...`);
    const apiColors = await this.searchDeviceColors(deviceType, brand, model);
    
    // Step 4: Save API results to database for future use
    if (apiColors.length > 0) {
      try {
        await storage.createDeviceColor({
          deviceType,
          brand,
          model,
          colors: apiColors,
          source: 'gsmarena'
        });
        console.log(`💾 Saved ${apiColors.length} API colors to database for ${brand} ${model}`);
      } catch (error) {
        console.error(`❌ Failed to save colors to database:`, error);
      }
    }
    
    // Cache API results in memory
    this.cache.set(cacheKey, {
      colors: apiColors,
      timestamp: Date.now()
    });
    
    return {
      colors: apiColors,
      fromCache: false
    };
  }

  // Get common colors as fallback
  getCommonColors(deviceType: string): string[] {
    const commonColorsByType: Record<string, string[]> = {
      phone: [
        'Black', 'White', 'Space Gray', 'Silver', 'Gold', 'Rose Gold',
        'Blue', 'Red', 'Green', 'Purple', 'Pink', 'Yellow'
      ],
      laptop: [
        'Space Gray', 'Silver', 'Black', 'White', 'Blue', 'Rose Gold',
        'Gold', 'Red', 'Green'
      ],
      desktop: [
        'Black', 'White', 'Silver', 'Gray', 'Blue', 'Red'
      ]
    };
    
    return commonColorsByType[deviceType.toLowerCase()] || commonColorsByType.phone;
  }

  clearCache(): void {
    this.cache.clear();
    console.log('🗑️ Device color cache cleared');
  }
}

export const deviceColorService = new DeviceColorService();