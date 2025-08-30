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
        temperature: 0.3 // Lower temperature for more consistent results
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
   */
  async generateAllDeviceBrandLists(): Promise<void> {
    const deviceTypes = ['Phone', 'Laptop', 'Desktop'];
    
    for (const deviceType of deviceTypes) {
      try {
        console.log(`Generating brand list for ${deviceType}...`);
        
        const { brands } = await this.generateDeviceBrands(deviceType);
        
        // Check if list already exists
        const existingList = await storage.getAutoGenList(deviceType);
        
        if (existingList) {
          // Update existing list
          await storage.updateAutoGenList(existingList.id, {
            items: brands,
            lastGenerated: new Date(),
            nextUpdate: this.getNextWeeklyUpdate(),
            updatedAt: new Date()
          });
          console.log(`Updated ${deviceType} brand list with ${brands.length} brands`);
        } else {
          // Create new list
          const newList: InsertAutoGenList = {
            listType: `AutoGen-List-Brands-${deviceType}`,
            category: deviceType,
            items: brands,
            lastGenerated: new Date(),
            nextUpdate: this.getNextWeeklyUpdate(),
            isActive: true
          };
          
          await storage.createAutoGenList(newList);
          console.log(`Created ${deviceType} brand list with ${brands.length} brands`);
        }
      } catch (error) {
        console.error(`Failed to generate/update brand list for ${deviceType}:`, error);
      }
    }
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
            nextUpdate: this.getNextWeeklyUpdate(),
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
   * Get next weekly update timestamp (7 days from now)
   */
  private getNextWeeklyUpdate(): Date {
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    return nextWeek;
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