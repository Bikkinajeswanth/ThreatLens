require('dotenv').config();
const app = require('./src/app');
const { startScheduler } = require('./src/jobs/scanQueue');

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`🚀 ThreatLens server running on port ${PORT}`);
  console.log(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);
  startScheduler();
});
