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
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:5175'],
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
// API routes
// --------------------
app.use('/api', routes);

// --------------------
// 404 handler (IMPORTANT)
// --------------------
app.use((req, res, next) => {
  res.status(404);
  next(new Error('API route not found'));
});

// --------------------
// Global error handler
// MUST have 4 arguments
// --------------------
app.use(errorHandler);

module.exports = app;