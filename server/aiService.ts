import OpenAI from "openai";
import { storage } from "./storage";
import type { InsertAutoGenList } from "@shared/schema";

const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY,
  timeout: 20000, // Much shorter timeout - 20 seconds
  maxRetries: 1 // Only one retry to prevent long waits
});

// Generation status tracking
interface GenerationStatus {
  deviceType: string;
  totalBrands: number;
  processedBrands: number;
  failedBrands: string[];
  status: 'idle' | 'running' | 'completed' | 'failed' | 'cancelled';
  startTime: Date;
  lastProgress: Date;
  errorMessage?: string;
}

class GenerationStatusManager {
  private statuses = new Map<string, GenerationStatus>();
  private readonly STALE_TIMEOUT = 5 * 60 * 1000; // 5 minutes

  startGeneration(deviceType: string, totalBrands: number): void {
    const status: GenerationStatus = {
      deviceType,
      totalBrands,
      processedBrands: 0,
      failedBrands: [],
      status: 'running',
      startTime: new Date(),
      lastProgress: new Date()
    };
    this.statuses.set(deviceType, status);
    console.log(`📊 Started generation for ${deviceType} - ${totalBrands} brands`);
  }

  updateProgress(deviceType: string, processedBrands: number, failedBrands: string[] = []): void {
    const status = this.statuses.get(deviceType);
    if (status) {
      status.processedBrands = processedBrands;
      status.failedBrands = failedBrands;
      status.lastProgress = new Date();
      console.log(`📊 Progress ${deviceType}: ${processedBrands}/${status.totalBrands} (${failedBrands.length} failed)`);
    }
  }

  completeGeneration(deviceType: string, success: boolean, errorMessage?: string): void {
    const status = this.statuses.get(deviceType);
    if (status) {
      status.status = success ? 'completed' : 'failed';
      status.errorMessage = errorMessage;
      console.log(`📊 ${success ? 'Completed' : 'Failed'} generation for ${deviceType}`);
    }
  }

  getStatus(deviceType: string): GenerationStatus | undefined {
    return this.statuses.get(deviceType);
  }

  isStale(deviceType: string): boolean {
    const status = this.statuses.get(deviceType);
    if (!status || status.status !== 'running') return false;
    
    const timeSinceLastProgress = Date.now() - status.lastProgress.getTime();
    return timeSinceLastProgress > this.STALE_TIMEOUT;
  }

  cancelStaleGenerations(): void {
    for (const [deviceType, status] of this.statuses.entries()) {
      if (this.isStale(deviceType)) {
        status.status = 'cancelled';
        status.errorMessage = 'Generation timed out - no progress for 5 minutes';
        console.log(`⏱️ Cancelled stale generation for ${deviceType}`);
      }
    }
  }

  getAllStatuses(): GenerationStatus[] {
    return Array.from(this.statuses.values());
  }
}

const statusManager = new GenerationStatusManager();

// Periodic cleanup of stale generations
setInterval(() => {
  statusManager.cancelStaleGenerations();
}, 60000); // Check every minute

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
   * Get current generation status for monitoring
   */
  getGenerationStatus(deviceType?: string): GenerationStatus | GenerationStatus[] {
    if (deviceType) {
      return statusManager.getStatus(deviceType);
    }
    return statusManager.getAllStatuses();
  }

  /**
   * Cancel a stuck generation process
   */
  cancelGeneration(deviceType: string): boolean {
    const status = statusManager.getStatus(deviceType);
    if (status && status.status === 'running') {
      statusManager.completeGeneration(deviceType, false, 'Manually cancelled');
      console.log(`🛑 Manually cancelled generation for ${deviceType}`);
      return true;
    }
    return false;
  }

  /**
   * Cancel all running generations (for emergency reset)
   */
  cancelAllGenerations(): number {
    const allStatuses = statusManager.getAllStatuses();
    const runningGenerations = allStatuses.filter(s => s.status === 'running');
    
    runningGenerations.forEach(status => {
      statusManager.completeGeneration(status.deviceType, false, 'Bulk cancelled - system reset');
      console.log(`🛑 Emergency cancelled generation for ${status.deviceType}`);
    });
    
    return runningGenerations.length;
  }

  /**
   * Reset generation status (for recovery)
   */
  resetGenerationStatus(deviceType: string): void {
    statusManager.completeGeneration(deviceType, false, 'Status reset');
    console.log(`🔄 Reset generation status for ${deviceType}`);
  }

  /**
   * Retry failed brands for a specific device type
   * WARNING: This makes OpenAI API calls which cost money - only use when explicitly requested
   */
  async retryFailedBrands(deviceType: string): Promise<{ retriedBrands: string[], successCount: number, stillFailedBrands: string[] }> {
    console.log(`⚠️  COST WARNING: Retrying failed brands for ${deviceType} - this will make OpenAI API calls`);
    
    const status = statusManager.getStatus(deviceType);
    if (!status || status.failedBrands.length === 0) {
      throw new Error(`No failed brands found for ${deviceType}`);
    }

    const failedBrands = [...status.failedBrands];
    console.log(`🔄 Retrying ${failedBrands.length} failed brands for ${deviceType}: ${failedBrands.join(', ')}`);

    // Check for existing generation and prevent concurrent retries
    if (status.status === 'running') {
      throw new Error(`Generation already in progress for ${deviceType}`);
    }

    try {
      // Start retry generation tracking
      statusManager.startGeneration(deviceType, status.totalBrands);
      
      const results = await this.generateModelsBatch(deviceType, failedBrands);
      const successfulBrands: string[] = [];
      const stillFailedBrands: string[] = [];

      // Process retry results and save to database
      for (const brand of failedBrands) {
        if (results[brand] && results[brand].length > 0) {
          try {
            await this.saveModelListToDatabase(deviceType, brand, results[brand]);
            successfulBrands.push(brand);
            console.log(`✅ Retry successful for ${brand}: ${results[brand].length} models`);
          } catch (error) {
            console.error(`💾 Storage error during retry for ${brand}:`, error);
            stillFailedBrands.push(brand);
          }
        } else {
          stillFailedBrands.push(brand);
          console.log(`❌ Retry still failed for ${brand}`);
        }
      }

      // Update status with retry results
      const newFailedBrands = status.failedBrands.filter(brand => !successfulBrands.includes(brand));
      statusManager.updateProgress(deviceType, status.processedBrands + successfulBrands.length, newFailedBrands);
      statusManager.completeGeneration(deviceType, stillFailedBrands.length === 0, 
        stillFailedBrands.length > 0 ? `${stillFailedBrands.length} brands still failed after retry` : undefined);

      console.log(`🎉 Retry completed: ${successfulBrands.length} successful, ${stillFailedBrands.length} still failed`);
      
      return {
        retriedBrands: failedBrands,
        successCount: successfulBrands.length,
        stillFailedBrands
      };

    } catch (error) {
      console.error(`❌ Retry failed for ${deviceType}:`, error);
      statusManager.completeGeneration(deviceType, false, `Retry failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Save model list to database (helper method)
   */
  private async saveModelListToDatabase(deviceType: string, brand: string, models: string[]): Promise<void> {
    const listType = `AutoGen-List-Models-${deviceType}-${brand}`;
    
    const existingList = await storage.getAutoGenListByType(listType);
    
    if (existingList) {
      await storage.updateAutoGenList(existingList.id, {
        items: models,
        lastGenerated: new Date(),
        nextUpdate: this.getNextUpdate(),
        updatedAt: new Date()
      });
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
    }
  }
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
        max_completion_tokens: 800
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
   * Enhanced logging for debugging generation process
   */
  private logGenerationStep(step: string, details: any = {}) {
    const timestamp = new Date().toISOString();
    console.log(`🔍 [${timestamp}] ${step}`, details);
  }

  /**
   * Generate device models for multiple brands at once (cost-optimized batch processing)
   */
  async generateBatchDeviceModels(deviceType: string, brands: string[]): Promise<BatchModelGenerationResult> {
    const currentYear = new Date().getFullYear();
    const startYear = currentYear - 4;
    
    // Process brands in batches of 2 for maximum reliability (reduced from 3)
    const batchSize = 2;
    const results: { [brand: string]: string[] } = {};
    const maxRetries = 2; // Reduced retries to avoid long waits
    const retryDelay = 1500; // Shorter delay between retries
    
    this.logGenerationStep(`Starting batch generation`, { 
      deviceType, 
      totalBrands: brands.length, 
      batchSize,
      brands: brands.slice(0, 5).join(', ') + (brands.length > 5 ? '...' : '')
    });
    
    for (let i = 0; i < brands.length; i += batchSize) {
      const batch = brands.slice(i, i + batchSize);
      const batchNumber = Math.floor(i / batchSize) + 1;
      const totalBatches = Math.ceil(brands.length / batchSize);
      
      console.log(`📦 Processing batch ${batchNumber}/${totalBatches}: ${batch.join(', ')}`);
      
      const prompt = `List comprehensive ${deviceType} models released from ${startYear} to ${currentYear} (inclusive) for these brands: ${batch.join(', ')}.

JSON: {"${batch[0]}": ["Model1", "Model2"], "${batch[1] || 'Brand2'}": ["Model1", "Model2"], ...}

Include ALL models from this 4-year period (${startYear}, ${startYear + 1}, ${startYear + 2}, ${startYear + 3}, ${currentYear}):
- Recent models from ${currentYear} and ${currentYear - 1}
- Mid-period models from ${currentYear - 2} and ${currentYear - 3}
- Earlier models from ${startYear}
- Both consumer and professional variants
- Popular models commonly brought for repairs
- Official model names/numbers (not marketing names)

For each brand, max 30 models, prioritize variety across all years ${startYear}-${currentYear}.`;
      
      let attempt = 0;
      let success = false;
      
      while (attempt < maxRetries && !success) {
        try {
          attempt++;
          this.logGenerationStep(`API request attempt`, { 
            batchNumber, 
            attempt, 
            maxRetries, 
            brands: batch,
            deviceType
          });
          
          // Add timeout wrapper
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
          
          // Try OpenAI first, but use immediate fallbacks if unreliable
          let response;
          try {
            // Reduced timeout for faster fallback
            response = await Promise.race([
              openai.chat.completions.create({
                model: "gpt-5", // the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
                messages: [
                  {
                    role: "system",
                    content: `Expert in device models for repair shops. Provide accurate model lists spanning the full 4-year range (${startYear}-${currentYear}). JSON format: {\"BrandName\": [\"Model1\", \"Model2\"]}`
                  },
                  {
                    role: "user",
                    content: prompt
                  }
                ],
                response_format: { type: "json_object" },
                max_completion_tokens: 1000
              }),
              new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Quick timeout for fast fallback')), 10000)
              )
            ]) as OpenAI.Chat.Completions.ChatCompletion;
          } catch (apiError) {
            this.logGenerationStep(`API call failed (${apiError.message}), using fallbacks immediately`, { 
              brands: batch,
              batchNumber,
              attempt
            });
            // Immediate fallback on any API error
            throw new Error('API unavailable - using fallbacks');
          }
          
          clearTimeout(timeoutId);
          
          // Validate response
          const content = response.choices[0]?.message?.content;
          if (!content) {
            throw new Error('Empty response from OpenAI');
          }
          
          const batchResults = JSON.parse(content);
          
          // Validate JSON structure
          if (typeof batchResults !== 'object' || Array.isArray(batchResults)) {
            throw new Error('Invalid JSON structure in response');
          }
          
          // Merge batch results with validation
          for (const brand of batch) {
            if (batchResults[brand] && Array.isArray(batchResults[brand])) {
              results[brand] = batchResults[brand].slice(0, 30);
              console.log(`✅ ${brand}: ${results[brand].length} models`);
            } else {
              console.log(`⚠️  ${brand}: No models in response, using fallback`);
              const fallback = this.getFallbackModels(deviceType, brand);
              results[brand] = fallback.models.slice(0, 30);
            }
          }
          
          success = true;
          this.logGenerationStep(`Batch completed successfully`, { 
            batchNumber, 
            totalBatches,
            processedBrands: batch.length,
            deviceType
          });
          
        } catch (error) {
          console.error(`❌ Batch ${batchNumber} attempt ${attempt} failed:`, error);
          
          if (attempt === maxRetries) {
            console.log(`🚨 All attempts failed for batch ${batchNumber}, using fallbacks`);
            // Add fallback for all failed brands in this batch
            for (const brand of batch) {
              if (!results[brand]) {
                const fallback = this.getFallbackModels(deviceType, brand);
                results[brand] = fallback.models.slice(0, 30);
                console.log(`🔄 Fallback for ${brand}: ${results[brand].length} models`);
              }
            }
          } else {
            // Wait before retry with exponential backoff
            const waitTime = retryDelay * Math.pow(2, attempt - 1);
            console.log(`⏱️  Waiting ${waitTime}ms before retry...`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
          }
        }
      }
      
      // Progress update
      const processedCount = i + batchSize;
      statusManager.updateProgress(deviceType, Math.min(processedCount, brands.length));
      
      // Longer delay between batches to respect rate limits
      if (i + batchSize < brands.length) {
        console.log(`⏱️  Waiting 1 second before next batch...`);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    console.log(`🎉 Batch generation completed for ${deviceType}`);
    return {
      results,
      category: deviceType
    };
  }

  /**
   * Generate comprehensive device model lists for a specific brand and device type using AI
   * Includes models from today going back 4 years to focus on relevant devices
   */
  async generateDeviceModels(deviceType: string, brand: string): Promise<ModelGenerationResult> {
    const currentYear = new Date().getFullYear();
    const startYear = currentYear - 4; // 4 years back from current year

    const prompt = `List comprehensive ${brand} ${deviceType} models released from ${startYear} to ${currentYear} (inclusive) for repair shops.

JSON format: {"models": ["Model1", "Model2", ...]}

Include ALL models from this 4-year period (${startYear}, ${startYear + 1}, ${startYear + 2}, ${startYear + 3}, ${currentYear}):
- Recent models from ${currentYear} and ${currentYear - 1}
- Mid-period models from ${currentYear - 2} and ${currentYear - 3}  
- Earlier models from ${startYear}
- Both consumer and professional variants
- Popular models commonly brought for repairs
- Official model names/numbers (not marketing names)

Focus on models actually sold and commonly repaired. Max 40 models, prioritize variety across all years ${startYear}-${currentYear}.`;

    try {
      const response = await openai.chat.completions.create({
        model: "gpt-5", // the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
        messages: [
          {
            role: "system",
            content: `Expert in device models for repair shops. Provide accurate model lists spanning the full 4-year range (${startYear}-${currentYear}).`
          },
          {
            role: "user",
            content: prompt
          }
        ],
        response_format: { type: "json_object" },
        max_completion_tokens: 1200
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
        max_completion_tokens: 800
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
      // Check for existing generation and cancel if stale
      statusManager.cancelStaleGenerations();
      
      const existingStatus = statusManager.getStatus(deviceType);
      if (existingStatus?.status === 'running') {
        console.log(`⚠️  Generation already in progress for ${deviceType}`);
        throw new Error(`Generation already in progress for ${deviceType}`);
      }
      
      // Check for any running generations globally to prevent overload
      const allStatuses = statusManager.getAllStatuses();
      const runningGenerations = allStatuses.filter(s => s.status === 'running');
      if (runningGenerations.length > 0) {
        console.log(`⚠️  Another generation is running: ${runningGenerations[0].deviceType}`);
        throw new Error(`Another generation is running for ${runningGenerations[0].deviceType}. Please wait for it to complete.`);
      }
      
      // Get existing brand list for this device type
      const brandList = await storage.getAutoGenList(deviceType);
      
      if (!brandList || !brandList.items || brandList.items.length === 0) {
        console.log(`❌ No brand list found for ${deviceType}. Generate brands first.`);
        statusManager.completeGeneration(deviceType, false, 'No brand list found');
        return;
      }
      
      console.log(`📱 Found ${brandList.items.length} brands for ${deviceType}`);
      
      // Start status tracking
      statusManager.startGeneration(deviceType, brandList.items.length);
      
      const brandsWithoutModels: string[] = [];
      const activeBrands: string[] = [];
      const failedBrands: string[] = [];
      
      try {
        // Use batch processing for better efficiency
        console.log(`💡 Using batch processing for ${brandList.items.length} brands`);
        const batchResults = await this.generateBatchDeviceModels(deviceType, brandList.items);
        
        // Process batch results with detailed tracking
        let processedCount = 0;
        for (const brand of brandList.items) {
          try {
            const models = batchResults.results[brand] || [];
            
            if (models.length === 0) {
              brandsWithoutModels.push(brand);
              console.log(`🚫 ${brand} has no ${deviceType} models - will be excluded`);
            } else {
              activeBrands.push(brand);
              
              // Save/update model list with error handling
              const listType = `AutoGen-List-Models-${deviceType}-${brand}`;
              
              try {
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
              } catch (storageError) {
                console.error(`💾 Storage error for ${brand}:`, storageError);
                failedBrands.push(brand);
              }
            }
            
            processedCount++;
            statusManager.updateProgress(deviceType, processedCount, failedBrands);
            
          } catch (brandError) {
            console.error(`❌ Error processing brand ${brand}:`, brandError);
            failedBrands.push(brand);
            processedCount++;
            statusManager.updateProgress(deviceType, processedCount, failedBrands);
          }
        }
        
        // Update the brand list to remove brands without models
        if (brandsWithoutModels.length > 0) {
          try {
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
          } catch (updateError) {
            console.error(`💾 Failed to update brand list:`, updateError);
          }
        }
        
        // Mark generation as completed
        const successMessage = `Completed: ${activeBrands.length} brands with models, ${brandsWithoutModels.length} excluded, ${failedBrands.length} failed`;
        statusManager.completeGeneration(deviceType, failedBrands.length === 0, failedBrands.length > 0 ? `Some brands failed: ${failedBrands.join(', ')}` : undefined);
        console.log(`🎉 ${successMessage}`);
        
      } catch (batchError) {
        console.error(`💥 Batch generation failed for ${deviceType}:`, batchError);
        statusManager.completeGeneration(deviceType, false, `Batch generation failed: ${batchError.message}`);
        throw batchError;
      }
      
    } catch (error) {
      console.error(`❌ Failed to generate model lists for ${deviceType}:`, error);
      statusManager.completeGeneration(deviceType, false, `Generation failed: ${error.message}`);
      throw error;
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
        response_format: { type: "json_object" },
        max_completion_tokens: 200
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
        Apple: ['iPhone 15 Pro Max', 'iPhone 15 Pro', 'iPhone 15', 'iPhone 15 Plus', 'iPhone 14 Pro Max', 'iPhone 14 Pro', 'iPhone 14', 'iPhone 14 Plus', 'iPhone 13 Pro Max', 'iPhone 13 Pro', 'iPhone 13', 'iPhone 13 mini', 'iPhone 12 Pro Max', 'iPhone 12 Pro', 'iPhone 12', 'iPhone 12 mini'],
        Samsung: ['Galaxy S24 Ultra', 'Galaxy S24+', 'Galaxy S24', 'Galaxy S23 Ultra', 'Galaxy S23+', 'Galaxy S23', 'Galaxy S22 Ultra', 'Galaxy S22+', 'Galaxy S22', 'Galaxy S21 Ultra', 'Galaxy S21+', 'Galaxy S21', 'Galaxy Note 20 Ultra', 'Galaxy Note 20'],
        Google: ['Pixel 8 Pro', 'Pixel 8', 'Pixel 7 Pro', 'Pixel 7', 'Pixel 7a', 'Pixel 6 Pro', 'Pixel 6', 'Pixel 6a', 'Pixel 5', 'Pixel 4a 5G', 'Pixel 4a'],
        OnePlus: ['OnePlus 12', 'OnePlus 11', 'OnePlus 10 Pro', 'OnePlus 10T', 'OnePlus 9 Pro', 'OnePlus 9', 'OnePlus 8T', 'OnePlus 8 Pro', 'OnePlus 8'],
        Xiaomi: ['Xiaomi 14 Ultra', 'Xiaomi 14', 'Xiaomi 13 Ultra', 'Xiaomi 13', 'Xiaomi 12 Ultra', 'Xiaomi 12', 'Xiaomi 11 Ultra', 'Xiaomi 11', 'Mi 10T Pro', 'Mi 10T']
      },
      Laptop: {
        Apple: ['MacBook Pro 16" M3', 'MacBook Pro 14" M3', 'MacBook Air 15" M2', 'MacBook Air 13" M2', 'MacBook Pro 13" M2', 'MacBook Pro 16" M2', 'MacBook Pro 14" M2', 'MacBook Air M1', 'MacBook Pro 13" M1', 'MacBook Pro 16" M1'],
        Dell: ['XPS 13 Plus', 'XPS 15', 'XPS 17', 'XPS 13', 'Inspiron 15 3000', 'Inspiron 14 5000', 'Latitude 7420', 'Latitude 5520', 'Precision 5560', 'Alienware m15 R7'],
        HP: ['Spectre x360 16', 'Spectre x360 14', 'Envy 13', 'Envy 15', 'Pavilion 15', 'Pavilion 14', 'EliteBook 840', 'EliteBook 850', 'ProBook 450', 'ProBook 455'],
        Lenovo: ['ThinkPad X1 Carbon Gen 11', 'ThinkPad X1 Carbon Gen 10', 'ThinkPad T14', 'ThinkPad T15', 'IdeaPad 5', 'IdeaPad 3', 'Legion 5', 'Legion 7', 'Yoga 9i', 'Yoga Slim 7'],
        Asus: ['ZenBook 14', 'ZenBook 13', 'VivoBook S15', 'VivoBook Pro 15', 'ROG Zephyrus G14', 'ROG Zephyrus G15', 'TUF Gaming A15', 'TUF Gaming F15']
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