import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { storage } from "./storage";
import { aiService } from "./aiService";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '5000', 10);
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
    
    // Start database keepalive to prevent suspension
    startDatabaseKeepalive();
    
    // Start auto-generated lists management system
    startAutoGenListsManager();
  });

  // Database keepalive system
  function startDatabaseKeepalive() {
    const keepaliveInterval = 4 * 60 * 1000; // 4 minutes (before 5-minute suspension)
    
    setInterval(async () => {
      try {
        const isHealthy = await storage.healthCheck();
        if (isHealthy) {
          log('Database keepalive: healthy');
        } else {
          log('Database keepalive: WARNING - health check failed');
        }
      } catch (error) {
        log(`Database keepalive: ERROR - ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }, keepaliveInterval);
    
    log(`Database keepalive started (every ${keepaliveInterval / 1000}s)`);
  }

  // Auto-generated lists management system
  function startAutoGenListsManager() {
    // DISABLED: Automatic updates are disabled to prevent unwanted OpenAI API costs
    // Only manual updates through the API endpoints will trigger AI generation
    log('Auto-gen lists manager: Automatic updates DISABLED for cost control');
    log('💰 Lists will only update when manually triggered via API endpoints');
    
    // Optional: Uncomment to enable automatic checks (WILL COST MONEY)
    /*
    const updateCheckInterval = 6 * 60 * 60 * 1000; // 6 hours
    
    setTimeout(async () => {
      try {
        log('Checking for expired auto-generated lists...');
        await aiService.updateExpiredLists();
      } catch (error) {
        log(`Auto-gen lists initial check failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }, 60 * 1000);
    
    setInterval(async () => {
      try {
        log('Checking for expired auto-generated lists...');
        await aiService.updateExpiredLists();
      } catch (error) {
        log(`Auto-gen lists update check failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }, updateCheckInterval);
    
    log(`Auto-gen lists manager started (checks every ${updateCheckInterval / (60 * 60 * 1000)} hours)`);
    */
  }
})();
