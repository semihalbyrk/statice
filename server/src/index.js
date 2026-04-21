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
const catalogueRoutes = require('./routes/catalogue');
const processingRoutes = require('./routes/processing');
const processorsRoutes = require('./routes/processors');
const reportsRoutes = require('./routes/reports');
const adminRoutes = require('./routes/admin');
const dashboardRoutes = require('./routes/dashboard');
const notificationRoutes = require('./routes/notifications');
const feesRoutes = require('./routes/fees');
const contractsRoutes = require('./routes/contracts');
const invoicesRoutes = require('./routes/invoices');
const contaminationRoutes = require('./routes/contamination');
const entitiesRoutes = require('./routes/entities');
const outboundOrderRoutes = require('./routes/outboundOrders');
const outboundRoutes = require('./routes/outbounds');
const outboundParcelRoutes = require('./routes/outboundParcels');
const { ensureCompatibilityFixtures } = require('./utils/compatFixtures');

const app = express();
const compatibilityReady = ensureCompatibilityFixtures().catch((error) => {
  console.error('Compatibility fixture bootstrap failed:', error);
  throw error;
});

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
app.use(async (req, res, next) => {
  try {
    await compatibilityReady;
    next();
  } catch (error) {
    next(error);
  }
});

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
app.use('/api/catalogue', catalogueRoutes);
app.use('/api/processing', processingRoutes);
app.use('/api/processors', processorsRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/fees', feesRoutes);
app.use('/api/contracts', contractsRoutes);
app.use('/api/invoices', invoicesRoutes);
app.use('/api/contamination', contaminationRoutes);
app.use('/api/entities', entitiesRoutes);
app.use('/api/outbound-orders', outboundOrderRoutes);
app.use('/api/outbounds', outboundRoutes);
app.use('/api/outbound-parcels', outboundParcelRoutes);
app.use('/api/containers', require('./routes/containerRegistry'));

// Global error handler
const errorHandler = require('./middleware/errorHandler');
app.use(errorHandler);

const PORT = process.env.PORT || 3001;
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);

    // Initialize report scheduler (hourly cron)
    const { initScheduler } = require('./services/reportScheduler');
    initScheduler();
  });
}

module.exports = app;
