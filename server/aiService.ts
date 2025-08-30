import OpenAI from "openai";
import { storage } from "./storage";
import type { InsertAutoGenList } from "@shared/schema";

// the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

interface BrandGenerationResult {
  brands: string[];
  category: string;
}

interface ModelGenerationResult {
  models: string[];
  brand: string;
  category: string;
}

export class AIService {
  /**
   * Generate comprehensive device model lists for a specific brand and device type using AI
   * Limited to models from the last 4 years to focus on relevant devices
   */
  async generateDeviceModels(deviceType: string, brand: string): Promise<ModelGenerationResult> {
    const currentYear = new Date().getFullYear();
    const startYear = currentYear - 4; // 4 years back

    const prompt = `Generate a comprehensive list of ${brand} ${deviceType} models released from ${startYear} to ${currentYear} (last 4 years). Focus on models that are commonly repaired or serviced in repair shops.

For ${brand} ${deviceType} devices from ${startYear}-${currentYear}, provide a JSON response with an array of model names/numbers.

Response format: { "models": ["Model1", "Model2", ...] }

Requirements:
- Include only models released between ${startYear} and ${currentYear}
- Include both popular and less common models that might need repairs
- Use official model names/numbers as they appear on the device
- Include different storage variants if they have different model numbers
- Include both consumer and professional models
- Sort chronologically from newest to oldest
- Limit to 30-50 models to keep the list manageable`;

    try {
      const response = await openai.chat.completions.create({
        model: "gpt-5", // the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
        messages: [
          {
            role: "system",
            content: "You are an expert in device models and repair industry knowledge. Provide comprehensive, accurate model lists for repair management systems focusing on recent models from the last 4 years."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        response_format: { type: "json_object" },
      });

      const result = JSON.parse(response.choices[0].message.content || '{"models": []}');
      
      return {
        models: (result.models || []).slice(0, 50), // Limit to 50 models
        brand,
        category: deviceType
      };
    } catch (error) {
      console.error(`Failed to generate models for ${brand} ${deviceType}:`, error);
      // Fallback models if AI generation fails
      return this.getFallbackModels(deviceType, brand);
    }
  }

  /**
   * Generate comprehensive brand lists for device types using AI
   */
  async generateDeviceBrands(deviceType: string): Promise<BrandGenerationResult> {
    const prompt = `Generate a comprehensive list of popular device brands for ${deviceType} devices. Include both well-known international brands and regional brands. Focus on brands that are commonly repaired or serviced.

For ${deviceType} devices, provide a JSON response with an array of brand names. Include brands like major manufacturers, mid-range brands, and budget brands that are frequently encountered in repair shops.

Response format: { "brands": ["Brand1", "Brand2", ...] }

Requirements:
- Include 30-50 popular brands
- Mix of premium, mid-range, and budget brands
- Include both current and legacy brands that might still need repairs
- Focus on brands commonly seen in repair shops
- Sort alphabetically`;

    try {
      const response = await openai.chat.completions.create({
        model: "gpt-5",
        messages: [
          {
            role: "system",
            content: "You are an expert in device brands and repair industry knowledge. Provide comprehensive, accurate brand lists for repair management systems."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        response_format: { type: "json_object" },
        // Note: gpt-5 only supports default temperature (1), removed custom temperature
      });

      const result = JSON.parse(response.choices[0].message.content || '{"brands": []}');
      
      return {
        brands: (result.brands || []).sort(),
        category: deviceType
      };
    } catch (error) {
      console.error(`Failed to generate brands for ${deviceType}:`, error);
      // Fallback brands if AI generation fails
      return this.getFallbackBrands(deviceType);
    }
  }

  /**
   * Generate model lists for all brands of a specific device type
   * WARNING: This makes OpenAI API calls which cost money - only use when explicitly requested
   */
  async generateAllDeviceModelLists(deviceType: string): Promise<void> {
    console.log(`⚠️  COST WARNING: Starting AI model list generation for ${deviceType} - this will make OpenAI API calls`);
    
    try {
      // Get existing brand list for this device type
      const brandList = await storage.getAutoGenList(deviceType);
      
      if (!brandList || !brandList.items || brandList.items.length === 0) {
        console.log(`❌ No brand list found for ${deviceType}. Generate brands first.`);
        return;
      }
      
      console.log(`📱 Found ${brandList.items.length} brands for ${deviceType}`);
      
      const brandsWithoutModels: string[] = [];
      const activeBrands: string[] = [];
      
      for (const brand of brandList.items) {
        try {
          console.log(`💰 Making OpenAI API call for ${brand} ${deviceType} models...`);
          
          const { models } = await this.generateDeviceModels(deviceType, brand);
          
          if (models.length === 0) {
            // Brand has no models - track for removal
            console.log(`🚫 ${brand} has no ${deviceType} models - will be excluded from brand list`);
            brandsWithoutModels.push(brand);
          } else {
            // Brand has models - keep it active
            activeBrands.push(brand);
            
            // Check if model list already exists for this brand
            const listType = `AutoGen-List-Models-${deviceType}-${brand}`;
            const existingList = await storage.getAutoGenListByType(listType);
            
            if (existingList) {
              // Update existing list
              await storage.updateAutoGenList(existingList.id, {
                items: models,
                lastGenerated: new Date(),
                nextUpdate: this.getNextUpdate(),
                updatedAt: new Date()
              });
              console.log(`✅ Updated ${brand} ${deviceType} model list with ${models.length} models`);
            } else {
              // Create new list
              const newList: InsertAutoGenList = {
                listType,
                category: deviceType,
                brand,
                items: models,
                lastGenerated: new Date(),
                nextUpdate: this.getNextUpdate('quarterly'), // Default to quarterly
                refreshInterval: 'quarterly',
                isActive: true
              };
              
              await storage.createAutoGenList(newList);
              console.log(`✅ Created ${brand} ${deviceType} model list with ${models.length} models`);
            }
          }
          
          // Add a small delay between API calls to be respectful
          await new Promise(resolve => setTimeout(resolve, 1000));
          
        } catch (error) {
          console.error(`❌ Failed to generate/update model list for ${brand} ${deviceType}:`, error);
        }
      }
      
      // Update the brand list to remove brands without models and track excluded brands
      if (brandsWithoutModels.length > 0 || activeBrands.length !== brandList.items.length) {
        const currentExcluded = brandList.excludedBrands || [];
        const newExcluded = Array.from(new Set([...currentExcluded, ...brandsWithoutModels]));
        
        await storage.updateAutoGenList(brandList.id, {
          items: activeBrands,
          excludedBrands: newExcluded,
          lastGenerated: new Date(),
          nextUpdate: this.getNextUpdate(),
          updatedAt: new Date()
        });
        
        console.log(`🧹 Updated ${deviceType} brand list: ${activeBrands.length} active brands, ${brandsWithoutModels.length} brands excluded (no models)`);
        console.log(`📋 Excluded brands: ${newExcluded.join(', ')}`);
      }
    } catch (error) {
      console.error(`❌ Failed to generate model lists for ${deviceType}:`, error);
    }
    
    console.log(`💰 AI model list generation completed for ${deviceType}`);
  }

  /**
   * Generate or update brand lists for all device types
   * WARNING: This makes OpenAI API calls which cost money - only use when explicitly requested
   */
  async generateAllDeviceBrandLists(): Promise<void> {
    console.log('⚠️  COST WARNING: Starting AI brand list generation - this will make OpenAI API calls');
    const deviceTypes = ['Phone', 'Laptop', 'Desktop'];
    
    for (const deviceType of deviceTypes) {
      try {
        console.log(`💰 Making OpenAI API call for ${deviceType} brands...`);
        
        const { brands } = await this.generateDeviceBrands(deviceType);
        
        // Check if list already exists
        const existingList = await storage.getAutoGenList(deviceType);
        
        if (existingList) {
          // Filter out previously excluded brands that had no models
          const excludedBrands = existingList.excludedBrands || [];
          const filteredBrands = brands.filter(brand => !excludedBrands.includes(brand));
          
          if (excludedBrands.length > 0) {
            console.log(`🚫 Excluding ${excludedBrands.length} brands with no models: ${excludedBrands.join(', ')}`);
          }
          
          // Update existing list
          await storage.updateAutoGenList(existingList.id, {
            items: filteredBrands,
            lastGenerated: new Date(),
            nextUpdate: this.getNextUpdate(),
            updatedAt: new Date()
          });
          console.log(`✅ Updated ${deviceType} brand list with ${filteredBrands.length} brands (${brands.length - filteredBrands.length} excluded)`);
        } else {
          // Create new list
          const newList: InsertAutoGenList = {
            listType: `AutoGen-List-Brands-${deviceType}`,
            category: deviceType,
            items: brands,
            lastGenerated: new Date(),
            nextUpdate: this.getNextUpdate('quarterly'), // Default to quarterly
            refreshInterval: 'quarterly',
            isActive: true
          };
          
          await storage.createAutoGenList(newList);
          console.log(`✅ Created ${deviceType} brand list with ${brands.length} brands`);
        }
      } catch (error) {
        console.error(`❌ Failed to generate/update brand list for ${deviceType}:`, error);
      }
    }
    console.log('💰 AI brand list generation completed');
  }

  /**
   * Check and update lists that need weekly refresh
   */
  async updateExpiredLists(): Promise<void> {
    try {
      const expiredLists = await storage.getAutoGenListsForUpdate();
      
      if (expiredLists.length === 0) {
        console.log('No expired auto-generated lists found');
        return;
      }

      console.log(`Found ${expiredLists.length} expired lists to update`);
      
      for (const list of expiredLists) {
        try {
          console.log(`Updating expired list: ${list.listType}`);
          
          const { brands } = await this.generateDeviceBrands(list.category);
          
          await storage.updateAutoGenList(list.id, {
            items: brands,
            lastGenerated: new Date(),
            nextUpdate: this.getNextUpdate('quarterly'),
            updatedAt: new Date()
          });
          
          console.log(`Successfully updated ${list.listType} with ${brands.length} brands`);
        } catch (error) {
          console.error(`Failed to update list ${list.listType}:`, error);
        }
      }
    } catch (error) {
      console.error('Failed to check for expired lists:', error);
    }
  }

  /**
   * Get next update timestamp based on refresh interval
   */
  private getNextUpdate(refreshInterval: string = 'monthly'): Date {
    const now = new Date();
    
    switch (refreshInterval) {
      case 'weekly':
        now.setDate(now.getDate() + 7);
        break;
      case 'biweekly':
        now.setDate(now.getDate() + 14);
        break;
      case 'monthly':
        now.setMonth(now.getMonth() + 1);
        break;
      case 'quarterly':
        now.setMonth(now.getMonth() + 3);
        break;
      default:
        // Default to monthly if unknown interval
        now.setMonth(now.getMonth() + 1);
    }
    
    return now;
  }

  /**
   * Validate and potentially add a user-entered brand to the list
   */
  async validateAndAddBrand(deviceType: string, brandName: string): Promise<{ isValid: boolean; correctedName?: string; added: boolean }> {
    try {
      console.log(`🔍 Validating brand "${brandName}" for ${deviceType}...`);

      // Clean up the brand name
      const cleanBrand = brandName.trim();
      if (!cleanBrand) {
        return { isValid: false, added: false };
      }

      // Check if brand exists and get corrected spelling
      const validationPrompt = `Is "${cleanBrand}" a real ${deviceType.toLowerCase()} brand/manufacturer? 

Consider:
- Exact matches (Apple, Samsung, etc.)
- Common typos (Appel -> Apple, Samsang -> Samsung)
- Alternative spellings or abbreviations
- Regional brand names

Respond with JSON in this exact format:
{
  "isValid": boolean,
  "correctedName": "exact brand name" or null if invalid,
  "confidence": number between 0-1
}

Examples:
- "Appel" -> {"isValid": true, "correctedName": "Apple", "confidence": 0.9}
- "xyz123" -> {"isValid": false, "correctedName": null, "confidence": 0.1}`;

      const response = await openai.chat.completions.create({
        model: "gpt-5", // the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
        messages: [
          {
            role: "system",
            content: "You are an expert in device brands and manufacturers. Validate brand names and correct typos."
          },
          {
            role: "user",
            content: validationPrompt
          }
        ],
        response_format: { type: "json_object" }
        // Note: gpt-5 only supports default temperature (1), removed custom temperature
      });

      const result = JSON.parse(response.choices[0].message.content || '{"isValid": false, "correctedName": null}');
      
      if (result.isValid && result.correctedName) {
        // Try to add to the existing list
        const existingList = await storage.getAutoGenList(deviceType);
        
        if (existingList && !existingList.items.includes(result.correctedName)) {
          const updatedItems = [...existingList.items, result.correctedName].sort();
          await storage.updateAutoGenList(existingList.id, {
            items: updatedItems,
            updatedAt: new Date()
          });
          
          console.log(`✅ Added "${result.correctedName}" to ${deviceType} brand list`);
          return { 
            isValid: true, 
            correctedName: result.correctedName, 
            added: true 
          };
        }
        
        return { 
          isValid: true, 
          correctedName: result.correctedName, 
          added: false 
        };
      }

      return { isValid: false, added: false };
    } catch (error) {
      console.error(`❌ Brand validation failed for "${brandName}":`, error);
      // If validation fails, assume it's valid to not block the user
      return { isValid: true, correctedName: brandName, added: false };
    }
  }

  /**
   * Fallback model lists if AI generation fails
   */
  private getFallbackModels(deviceType: string, brand: string): ModelGenerationResult {
    const fallbackModels: Record<string, Record<string, string[]>> = {
      Phone: {
        Apple: ['iPhone 15 Pro Max', 'iPhone 15 Pro', 'iPhone 15', 'iPhone 14 Pro Max', 'iPhone 14 Pro', 'iPhone 14', 'iPhone 13 Pro Max', 'iPhone 13 Pro', 'iPhone 13'],
        Samsung: ['Galaxy S24 Ultra', 'Galaxy S24+', 'Galaxy S24', 'Galaxy S23 Ultra', 'Galaxy S23+', 'Galaxy S23', 'Galaxy S22 Ultra', 'Galaxy S22+', 'Galaxy S22'],
        Google: ['Pixel 8 Pro', 'Pixel 8', 'Pixel 7 Pro', 'Pixel 7', 'Pixel 6 Pro', 'Pixel 6'],
        OnePlus: ['OnePlus 12', 'OnePlus 11', 'OnePlus 10 Pro', 'OnePlus 9 Pro', 'OnePlus 9'],
        Xiaomi: ['Xiaomi 14 Ultra', 'Xiaomi 14', 'Xiaomi 13 Ultra', 'Xiaomi 13', 'Xiaomi 12 Ultra']
      },
      Laptop: {
        Apple: ['MacBook Pro 16" M3', 'MacBook Pro 14" M3', 'MacBook Air 15" M2', 'MacBook Air 13" M2', 'MacBook Pro 13" M2'],
        Dell: ['XPS 13 Plus', 'XPS 15', 'XPS 17', 'Inspiron 15 3000', 'Latitude 7420'],
        HP: ['Spectre x360', 'Envy 13', 'Pavilion 15', 'EliteBook 840', 'ProBook 450'],
        Lenovo: ['ThinkPad X1 Carbon', 'ThinkPad T14', 'IdeaPad 5', 'Legion 5', 'Yoga 9i'],
        Asus: ['ZenBook 14', 'VivoBook S15', 'ROG Zephyrus G14', 'TUF Gaming A15']
      },
      Desktop: {
        Dell: ['Inspiron 3880', 'XPS 8950', 'OptiPlex 7090', 'Alienware Aurora R13'],
        HP: ['Pavilion Desktop', 'OMEN 45L', 'EliteDesk 800', 'Workstation Z4'],
        Lenovo: ['IdeaCentre 5', 'Legion Tower 5i', 'ThinkCentre M90q', 'ThinkStation P340'],
        Asus: ['VivoPC', 'ROG Strix GT35', 'Mini PC PN50', 'ExpertCenter D5'],
        MSI: ['Codex R', 'Aegis RS 12', 'Creator P100X', 'Infinite S3']
      }
    };

    const models = fallbackModels[deviceType]?.[brand] || [`${brand} Model 1`, `${brand} Model 2`, `${brand} Model 3`];
    
    return {
      models: models.sort(),
      brand,
      category: deviceType
    };
  }

  /**
   * Fallback brand lists if AI generation fails
   */
  private getFallbackBrands(deviceType: string): BrandGenerationResult {
    const fallbackBrands: Record<string, string[]> = {
      Phone: [
        'Apple', 'Samsung', 'Google', 'OnePlus', 'Xiaomi', 'Huawei', 'Oppo', 'Vivo',
        'LG', 'Sony', 'Motorola', 'Nokia', 'Honor', 'Realme', 'Nothing', 'Fairphone'
      ],
      Laptop: [
        'Apple', 'Dell', 'HP', 'Lenovo', 'Asus', 'Acer', 'MSI', 'Razer',
        'Microsoft', 'Alienware', 'Thinkpad', 'MacBook', 'Surface', 'Chromebook'
      ],
      Desktop: [
        'Dell', 'HP', 'Lenovo', 'Asus', 'MSI', 'Alienware', 'Origin PC', 'Corsair',
        'NZXT', 'CyberPowerPC', 'iBuyPower', 'Falcon Northwest', 'Maingear'
      ]
    };

    return {
      brands: (fallbackBrands[deviceType] || []).sort(),
      category: deviceType
    };
  }
}

export const aiService = new AIService();