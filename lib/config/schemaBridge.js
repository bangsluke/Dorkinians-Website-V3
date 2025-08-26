/**
 * Schema Bridge for V3-Dorkinians-Website
 * 
 * This bridge allows the V3 repository to use the unified schema
 * from database-dorkinians via the Git submodule integration.
 * 
 * It provides backward compatibility with existing csvHeaders.js
 * while leveraging the unified schema system.
 */

const path = require('path');

// Try to load unified schema from database-dorkinians submodule
let unifiedSchema = null;
let csvHeaders = null;

try {
  // Attempt to load from submodule
  const submodulePath = path.join(__dirname, '../../../database-dorkinians');
  unifiedSchema = require(path.join(submodulePath, 'config/schema'));
  console.log('✅ Unified schema loaded from database-dorkinians submodule');
} catch (error) {
  console.warn('⚠️ Could not load unified schema from submodule:', error.message);
  console.warn('⚠️ Falling back to local csvHeaders configuration');
  
  // Fallback to local configuration
  const { csvHeaderConfigs } = require('./csvHeaders');
  csvHeaders = csvHeaderConfigs;
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
  } else if (csvHeaders) {
    // Fallback to local configuration
    return csvHeaders.find(config => config.name === tableName);
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
  } else if (csvHeaders) {
    // Fallback to local configuration
    return csvHeaders;
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
