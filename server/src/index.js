require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const morgan = require('morgan');

const authRoutes = require('./routes/auth');
const ordersRoutes = require('./routes/orders');
const carriersRoutes = require('./routes/carriers');
const suppliersRoutes = require('./routes/suppliers');
const weighingEventsRoutes = require('./routes/weighingEvents');
const assetsRoutes = require('./routes/assets');
const sortingRoutes = require('./routes/sorting');
const reportsRoutes = require('./routes/reports');
const adminRoutes = require('./routes/admin');
const dashboardRoutes = require('./routes/dashboard');

const app = express();

app.use(helmet());
app.use(cors({
  origin: 'http://localhost:3000',
  credentials: true,
}));
app.use(cookieParser());
app.use(express.json());
app.use(morgan('dev'));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date() });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/orders', ordersRoutes);
app.use('/api/carriers', carriersRoutes);
app.use('/api/suppliers', suppliersRoutes);
app.use('/api/weighing-events', weighingEventsRoutes);
app.use('/api/assets', assetsRoutes);
app.use('/api/sorting', sortingRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/dashboard', dashboardRoutes);

// Global error handler
app.use((err, req, res, next) => {
  // Handle known Prisma errors with appropriate HTTP status codes
  if (err.code === 'P2002') {
    console.error('Unique constraint violation:', err.meta);
    return res.status(409).json({ error: 'A record with this value already exists', field: err.meta?.target });
  }
  if (err.code === 'P2003') {
    console.error('Foreign key constraint failed:', err.meta);
    return res.status(400).json({ error: 'Referenced record not found', field: err.meta?.field_name });
  }
  if (err.code === 'P2025') {
    return res.status(404).json({ error: 'Record not found' });
  }
  if (err.code === 'P2006') {
    console.error('Invalid value for field:', err.meta);
    return res.status(400).json({ error: 'Invalid value provided', field: err.meta?.field_name });
  }

  console.error(err.stack);
  res.status(err.statusCode || 500).json({ error: err.statusCode ? err.message : 'Internal server error' });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
