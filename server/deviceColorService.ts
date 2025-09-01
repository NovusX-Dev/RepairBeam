// @ts-ignore - No type definitions available for gsmarena-api
import gsmarena from 'gsmarena-api';

interface DeviceColors {
  colors: string[];
  fromCache: boolean;
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

  async getDeviceColors(deviceType: string, brand: string, model: string): Promise<DeviceColors> {
    const cacheKey = this.getCacheKey(deviceType, brand, model);
    
    // Check cache first
    const cachedEntry = this.cache.get(cacheKey);
    if (cachedEntry && this.isValidCacheEntry(cachedEntry)) {
      console.log(`📦 Returning cached colors for ${brand} ${model}`);
      return {
        colors: cachedEntry.colors,
        fromCache: true
      };
    }
    
    // Search for device colors
    const colors = await this.searchDeviceColors(deviceType, brand, model);
    
    // Cache the results
    this.cache.set(cacheKey, {
      colors,
      timestamp: Date.now()
    });
    
    return {
      colors,
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