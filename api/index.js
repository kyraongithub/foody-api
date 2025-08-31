const app = require('../src/app');

module.exports = (req, res) => {
  // Set proper headers for Swagger UI assets
  if (req.url && req.url.includes('/api-swagger')) {
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader(
      'Access-Control-Allow-Methods',
      'GET, POST, PUT, DELETE, OPTIONS'
    );
    res.setHeader(
      'Access-Control-Allow-Headers',
      'Content-Type, Authorization'
    );
  }

  return app(req, res);
};
