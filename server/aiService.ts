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

interface BatchModelGenerationResult {
  results: { [brand: string]: string[] };
  category: string;
}

export class AIService {
  /**
   * Analyze routing errors and provide intelligent suggestions
   */
  async analyzeRoutingError(diagnosticInfo: any): Promise<{ suggestions: any[] }> {
    const prompt = `Analyze this web app routing error and suggest solutions:

Path: ${diagnosticInfo.currentPath}
Error: ${diagnosticInfo.errorMessage || 'Page not found'}
Available routes: ${diagnosticInfo.availableRoutes.join(', ')}
Referrer: ${diagnosticInfo.referrer}

Provide 3-4 helpful suggestions in JSON format:
{"suggestions": [{"type": "route|action|info", "title": "Short title", "description": "Helpful description", "path": "/route" or null, "confidence": 0.0-1.0}]}

Prioritize: 1) Similar routes 2) Common destinations 3) Helpful actions`;

    try {
      const response = await openai.chat.completions.create({
        model: "gpt-5",
        messages: [
          {
            role: "system",
            content: "Routing expert. Analyze navigation errors and suggest helpful solutions for web apps."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        response_format: { type: "json_object" },
      });

      const result = JSON.parse(response.choices[0].message.content || '{"suggestions": []}');
      return {
        suggestions: result.suggestions || []
      };
    } catch (error) {
      console.error('Failed to analyze routing error:', error);
      return {
        suggestions: [
          {
            type: 'route',
            title: 'Go to Dashboard',
            description: 'Return to the main application dashboard',
            path: '/',
            confidence: 0.9
          },
          {
            type: 'action',
            title: 'Refresh Page',
            description: 'Try refreshing the page to resolve temporary issues',
            confidence: 0.6
          }
        ]
      };
    }
  }
  /**
   * Generate device models for multiple brands at once (cost-optimized batch processing)
   */
  async generateBatchDeviceModels(deviceType: string, brands: string[]): Promise<BatchModelGenerationResult> {
    const currentYear = new Date().getFullYear();
    const startYear = currentYear - 4;
    
    // Process brands in batches of 5 for optimal token usage
    const batchSize = 5;
    const results: { [brand: string]: string[] } = {};
    
    for (let i = 0; i < brands.length; i += batchSize) {
      const batch = brands.slice(i, i + batchSize);
      
      const prompt = `List ${deviceType} models from ${startYear}-${currentYear} for these brands: ${batch.join(', ')}.

JSON: {"${batch[0]}": ["Model1", "Model2"], "${batch[1] || 'Brand2'}": ["Model1", "Model2"], ...}

For each brand, max 30 models, newest first, repair-relevant only.`;
      
      try {
        const response = await openai.chat.completions.create({
          model: "gpt-5",
          messages: [
            {
              role: "system",
              content: "Device model expert. Provide recent models for repair shops in exact JSON format."
            },
            {
              role: "user",
              content: prompt
            }
          ],
          response_format: { type: "json_object" },
        });
        
        const batchResults = JSON.parse(response.choices[0].message.content || '{}');
        
        // Merge batch results
        for (const brand of batch) {
          if (batchResults[brand]) {
            results[brand] = batchResults[brand].slice(0, 30);
          }
        }
        
        // Shorter delay for batch processing
        if (i + batchSize < brands.length) {
          await new Promise(resolve => setTimeout(resolve, 300));
        }
        
      } catch (error) {
        console.error(`Failed to generate batch models for ${batch.join(', ')}:`, error);
        // Add fallback for failed brands
        for (const brand of batch) {
          if (!results[brand]) {
            const fallback = this.getFallbackModels(deviceType, brand);
            results[brand] = fallback.models.slice(0, 30);
          }
        }
      }
    }
    
    return {
      results,
      category: deviceType
    };
  }

  /**
   * Generate comprehensive device model lists for a specific brand and device type using AI
   * Limited to models from the last 4 years to focus on relevant devices
   */
  async generateDeviceModels(deviceType: string, brand: string): Promise<ModelGenerationResult> {
    const currentYear = new Date().getFullYear();
    const startYear = currentYear - 4; // 4 years back

    const prompt = `List ${brand} ${deviceType} models from ${startYear}-${currentYear} for repair shops.

JSON format: {"models": ["Model1", "Model2", ...]}

Include:
- Official model names/numbers
- Popular and repair-relevant models
- Consumer and professional variants
- Max 40 models, newest first`;

    try {
      const response = await openai.chat.completions.create({
        model: "gpt-5", // the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
        messages: [
          {
            role: "system",
            content: "Expert in device models for repair shops. Provide accurate, recent model lists."
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
        models: (result.models || []).slice(0, 40), // Limit to 40 models for efficiency
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
    const prompt = `List popular ${deviceType} brands for repair shops.

JSON: {"brands": ["Brand1", "Brand2", ...]}

30-40 brands: premium, mid-range, budget. Include current and legacy brands commonly repaired.`;

    try {
      const response = await openai.chat.completions.create({
        model: "gpt-5",
        messages: [
          {
            role: "system",
            content: "Device brand expert for repair shops. Provide accurate brand lists."
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
      
      
      // Use batch processing for better efficiency
      console.log(`💡 Using batch processing for ${brandList.items.length} brands`);
      const batchResults = await this.generateBatchDeviceModels(deviceType, brandList.items);
      
      // Process batch results
      for (const brand of brandList.items) {
        const models = batchResults.results[brand] || [];
        
        if (models.length === 0) {
          brandsWithoutModels.push(brand);
          console.log(`🚫 ${brand} has no ${deviceType} models - will be excluded`);
        } else {
          activeBrands.push(brand);
          
          // Save/update model list
          const listType = `AutoGen-List-Models-${deviceType}-${brand}`;
          const existingList = await storage.getAutoGenListByType(listType);
          
          if (existingList) {
            await storage.updateAutoGenList(existingList.id, {
              items: models,
              lastGenerated: new Date(),
              nextUpdate: this.getNextUpdate(),
              updatedAt: new Date()
            });
            console.log(`✅ Updated ${brand} ${deviceType} model list with ${models.length} models`);
          } else {
            const newList: InsertAutoGenList = {
              listType,
              category: deviceType,
              brand,
              items: models,
              lastGenerated: new Date(),
              nextUpdate: this.getNextUpdate('quarterly'),
              refreshInterval: 'quarterly',
              isActive: true
            };
            
            await storage.createAutoGenList(newList);
            console.log(`✅ Created ${brand} ${deviceType} model list with ${models.length} models`);
          }
        }
      }
      
      // Update the brand list to remove brands without models
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
        
        console.log(`🧹 Updated ${deviceType} brand list: ${activeBrands.length} active brands, ${brandsWithoutModels.length} brands excluded`);
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
      const validationPrompt = `Validate "${cleanBrand}" as ${deviceType} brand. Check typos, abbreviations.

JSON: {"isValid": boolean, "correctedName": "exact name" or null, "confidence": 0-1}

Examples: "Appel"->{"isValid":true,"correctedName":"Apple","confidence":0.9}`;

      const response = await openai.chat.completions.create({
        model: "gpt-5",
        messages: [
          {
            role: "system",
            content: "Brand validator. Fix typos, validate manufacturers."
          },
          {
            role: "user",
            content: validationPrompt
          }
        ],
        response_format: { type: "json_object" }
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