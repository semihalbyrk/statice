require('dotenv').config();
const express = require('express');
const fs = require('fs');
const path = require('path');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const morgan = require('morgan');

const authRoutes = require('./routes/auth');
const ordersRoutes = require('./routes/orders');
const carriersRoutes = require('./routes/carriers');
const suppliersRoutes = require('./routes/suppliers');
const inboundsRoutes = require('./routes/weighingEvents');
const assetsRoutes = require('./routes/assets');
const sortingRoutes = require('./routes/sorting');
const reportsRoutes = require('./routes/reports');
const adminRoutes = require('./routes/admin');
const dashboardRoutes = require('./routes/dashboard');
const notificationRoutes = require('./routes/notifications');

const app = express();

// Ensure report storage directory exists
const storageDir = path.join(__dirname, '..', 'storage', 'reports');
if (!fs.existsSync(storageDir)) {
  fs.mkdirSync(storageDir, { recursive: true });
}

app.use(helmet());
app.use(cors({
  origin: 'http://localhost:3000',
  credentials: true,
  exposedHeaders: ['Content-Disposition'],
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
app.use('/api/inbounds', inboundsRoutes);
app.use('/api/assets', assetsRoutes);
app.use('/api/sorting', sortingRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/notifications', notificationRoutes);

// Global error handler
const errorHandler = require('./middleware/errorHandler');
app.use(errorHandler);

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);

  // Initialize report scheduler (hourly cron)
  const { initScheduler } = require('./services/reportScheduler');
  initScheduler();
});
