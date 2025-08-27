/**
 * Schema Bridge for V3-Dorkinians-Website
 * 
 * IMPORTANT: This bridge now references the schema from database-dorkinians repository.
 * To keep schemas aligned:
 * 1. Update schema in database-dorkinians/config/schema.js
 * 2. Copy the updated schema to this location
 * 3. Deploy both repositories
 * 
 * This ensures a single source of truth for all data structure definitions.
 */

// Load unified schema from database-dorkinians (copied here for alignment)
let unifiedSchema = null;

try {
  // Load from local config directory (copied from database-dorkinians)
  unifiedSchema = require('./schema');
  console.log('✅ Unified schema loaded from database-dorkinians (copied)');
} catch (error) {
  console.error('❌ Failed to load unified schema:', error.message);
  console.error('💡 Make sure to copy the latest schema from database-dorkinians/config/schema.js');
  throw new Error('Unified schema is required but could not be loaded');
}

/**
 * Get CSV header configuration for a specific table
 * @param {string} tableName - Name of the table
 * @returns {Object|null} Header configuration or null if not found
 */
function getCSVHeaderConfig(tableName) {
  if (unifiedSchema && unifiedSchema.schema[tableName]) {
    // Use unified schema
    const tableSchema = unifiedSchema.schema[tableName];
    return {
      name: tableName,
      expectedHeaders: Object.keys(tableSchema.csvColumns),
      description: `Schema-driven configuration for ${tableName}`,
      schema: tableSchema
    };
  }
  
  return null;
}

/**
 * Get all CSV header configurations
 * @returns {Array} Array of header configurations
 */
function getAllCSVHeaderConfigs() {
  if (unifiedSchema) {
    // Convert unified schema to header format
    return Object.keys(unifiedSchema.schema).map(tableName => {
      const tableSchema = unifiedSchema.schema[tableName];
      return {
        name: tableName,
        expectedHeaders: Object.keys(tableSchema.csvColumns),
        description: `Schema-driven configuration for ${tableName}`,
        schema: tableSchema
      };
    });
  }
  
  return [];
}

/**
 * Validate CSV headers against expected schema
 * @param {Array} actualHeaders - Actual CSV headers
 * @param {string} tableName - Name of the table
 * @returns {Object} Validation result
 */
function validateCSVHeaders(actualHeaders, tableName) {
  const config = getCSVHeaderConfig(tableName);
  
  if (!config) {
    return {
      isValid: false,
      errors: [`No schema configuration found for ${tableName}`],
      actualHeaders,
      expectedHeaders: []
    };
  }
  
  const expectedHeaders = config.expectedHeaders;
  const missingHeaders = expectedHeaders.filter(header => !actualHeaders.includes(header));
  const extraHeaders = actualHeaders.filter(header => !expectedHeaders.includes(header));
  
  return {
    isValid: missingHeaders.length === 0,
    errors: missingHeaders.length > 0 ? [`Missing required headers: ${missingHeaders.join(', ')}`] : [],
    warnings: extraHeaders.length > 0 ? [`Extra headers found: ${extraHeaders.join(', ')}`] : [],
    actualHeaders,
    expectedHeaders,
    missingHeaders,
    extraHeaders
  };
}

/**
 * Get unified schema if available
 * @returns {Object|null} Unified schema or null
 */
function getUnifiedSchema() {
  return unifiedSchema;
}

/**
 * Check if unified schema is available
 * @returns {boolean} True if unified schema is loaded
 */
function hasUnifiedSchema() {
  return unifiedSchema !== null;
}

module.exports = {
  getCSVHeaderConfig,
  getAllCSVHeaderConfigs,
  validateCSVHeaders,
  getUnifiedSchema,
  hasUnifiedSchema,
  // Backward compatibility
  csvHeaderConfigs: getAllCSVHeaderConfigs()
};
