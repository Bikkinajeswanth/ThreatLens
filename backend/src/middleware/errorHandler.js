const errorHandler = (err, req, res, next) => {
  console.error('Backend: Error handler triggered:', err.message);
  console.error(err.stack);

  // Ensure we always send JSON response
  if (!res.headersSent) {
    res.status(res.statusCode !== 200 ? res.statusCode : 500).json({
      success: false,
      message: err.message || 'Internal Server Error'
    });
  }
};

module.exports = errorHandler;