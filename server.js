import 'dotenv/config';
import express from 'express';
import cors from 'cors';

import routes from './routes/index.js';
import errorHandler from './middleware/errorHandler.js';
import './services/cronService.js';

const app = express();

// CORS
app.use(cors({
  origin: ['https://lmsarmytech.netlify.app', 'http://localhost:3000'],
  credentials: true
}));

// Parse JSON
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// API Routes
app.use('/api', routes);

// Health check
app.get('/', (req, res) => {
  res.json({
    message: 'LMS API Server',
    version: '1.0.0',
    docs: '/api'
  });
});

// Error handler
app.use(errorHandler);

// 404
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`🚀 API Server: http://localhost:${PORT}`);
});