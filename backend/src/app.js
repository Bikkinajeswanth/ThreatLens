const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const connectDB = require('./config/database');
const errorHandler = require('./middleware/errorHandler');
const routes = require('./routes');

const app = express();

// --------------------
// Connect to database
// --------------------
connectDB();

// --------------------
// Security middleware
// --------------------
app.use(helmet());

// ✅ FINAL CORS CONFIG (PRODUCTION SAFE)
const allowedOrigins = [
'http://localhost:5173',
'http://localhost:5174',
'http://localhost:5175',
'https://threat-lens-umber.vercel.app'
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);

    // allow localhost
    if (
      origin === 'http://localhost:5173' ||
      origin === 'http://localhost:5174' ||
      origin === 'http://localhost:5175'
    ) {
      return callback(null, true);
    }

    // ✅ allow ALL Vercel domains
    if (origin.includes('vercel.app')) {
      return callback(null, true);
    }

    console.warn("Blocked by CORS: " + origin);
    return callback(null, false);
  },
  credentials: true
}));

// ❌ REMOVED app.options('*', cors());

app.use(morgan('dev'));

// --------------------
// Body parsing
// --------------------
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// --------------------
// Health check
// --------------------
app.get('/health', (req, res) => {
res.status(200).json({ status: 'ok' });
});

// --------------------
// Root route
// --------------------
app.get('/', (req, res) => {
res.send('ThreatLens API is running 🚀');
});

// --------------------
// API routes
// --------------------
app.use('/api', routes);

// --------------------
// 404 handler
// --------------------
app.use((req, res, next) => {
res.status(404);
next(new Error('API route not found'));
});

// --------------------
// Global error handler
// --------------------
app.use(errorHandler);

module.exports = app;
