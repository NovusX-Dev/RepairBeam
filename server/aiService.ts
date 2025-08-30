import OpenAI from "openai";
import { storage } from "./storage";
import type { InsertAutoGenList } from "@shared/schema";

// the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

interface BrandGenerationResult {
  brands: string[];
  category: string;
}

export class AIService {
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
        brands: result.brands || [],
        category: deviceType
      };
    } catch (error) {
      console.error(`Failed to generate brands for ${deviceType}:`, error);
      // Fallback brands if AI generation fails
      return this.getFallbackBrands(deviceType);
    }
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
          // Update existing list
          await storage.updateAutoGenList(existingList.id, {
            items: brands,
            lastGenerated: new Date(),
            nextUpdate: this.getNextUpdate(),
            updatedAt: new Date()
          });
          console.log(`✅ Updated ${deviceType} brand list with ${brands.length} brands`);
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
      brands: fallbackBrands[deviceType] || [],
      category: deviceType
    };
  }
}

export const aiService = new AIService();