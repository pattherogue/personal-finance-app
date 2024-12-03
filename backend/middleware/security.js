// backend/middleware/security.js
const basicSecurity = (req, res, next) => {
    // Basic input validation
    if (req.body) {
      const sanitized = Object.keys(req.body).reduce((acc, key) => {
        acc[key] = typeof req.body[key] === 'string' ? 
          req.body[key].trim() : req.body[key];
        return acc;
      }, {});
      req.body = sanitized;
    }
    next();
  };
  
  // backend/utils/monitoring.js
  const monitor = {
    logRequest: (req, res, next) => {
      console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
      next();
    },
    
    checkHealth: () => ({
      status: 'healthy',
      lastChecked: new Date(),
      dbConnection: 'connected'
    })
  };