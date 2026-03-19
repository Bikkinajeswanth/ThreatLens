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

// ✅ FIXED CORS CONFIG (IMPORTANT)
const allowedOrigins = [
'http://localhost:5173',
'http://localhost:5174',
'http://localhost:5175',
'https://threat-lens-umber.vercel.app'
];

app.use(cors({
origin: function (origin, callback) {
// allow requests with no origin (like Postman or mobile apps)
if (!origin) return callback(null, true);

```
if (allowedOrigins.includes(origin)) {
  callback(null, true);
} else {
  callback(new Error('Not allowed by CORS'));
}
```

},
credentials: true
}));

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
// Root route (optional)
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
