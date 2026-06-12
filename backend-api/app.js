const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const env = require('./config/env');
const db = require('./config/db');
const { standard } = require('./common/middleware/rate-limit.middleware');
const { requestId, requestLogger } = require('./common/middleware/request-logger.middleware');
const { optionalAuth } = require('./common/middleware/auth.middleware');
const notFound = require('./common/middleware/not-found.middleware');
const { errorHandler } = require('./common/middleware/error.middleware');

const authRoutes = require('./modules/auth/auth.routes');
const userRoutes = require('./modules/user/user.routes');
const routeRoutes = require('./modules/route/route.routes');
const stopRoutes = require('./modules/stop/stop.routes');
const busRoutes = require('./modules/bus/bus.routes');
const chatRoutes = require('./modules/chat/chat.routes');
const reportRoutes = require('./modules/report/report.routes');
const analyticsRoutes = require('./modules/analytics/analytics.routes');
const tourismRoutes = require('./modules/tourism/tourism.routes');
const reviewRoutes = require('./modules/review/review.routes');
const communityRoutes = require('./modules/community/community.routes');
const tripRoutes = require('./modules/trip/trip.routes');
const adminRoutes = require('./modules/admin/admin.routes');
const appBffRoutes = require('./modules/app-bff/app-bff.routes');
const provincesRoutes = require('./modules/provinces/provinces.routes');
const busDomainRoutes = require('./modules/bus-domain/bus-domain.routes');
const mapRoutes = require('./modules/map/map.routes');
const favoritesRoutes = require('./modules/favorites/favorites.routes');
const importRoutes = require('./modules/import/import.routes');
const statsRoutes = require('./modules/stats/stats.routes');
const notificationRoutes = require('./modules/notification/notification.routes');

const app = express();
app.disable('x-powered-by');
if (env.trustProxy) app.set('trust proxy', 1);

const corsOptions = {
  origin(origin, cb) {
    if (!origin) return cb(null, true);
    if (!env.isProduction && env.frontendOrigins.includes('*')) return cb(null, true);
    if (env.frontendOrigins.includes(origin)) return cb(null, true);
    return cb(null, false);
  },
  credentials: true,
};

app.use(requestId);
app.use(requestLogger);
app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(cors(corsOptions));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(standard);
app.use(optionalAuth);

async function healthPayload(includeDb = true) {
  const database = includeDb ? await db.healthCheck() : undefined;
  return {
    success: true,
    status: database && database.connected === false ? 'degraded' : 'ok',
    service: 'smartbus-backend',
    name: 'SmartBus Travel Connect API',
    architecture: 'Frontend -> Backend API/BFF -> Service -> Repository -> SQL Server',
    timestamp: new Date().toISOString(),
    uptime: Math.round(process.uptime()),
    environment: env.nodeEnv,
    ...(includeDb ? { database } : {}),
  };
}

app.get(`${env.apiPrefix}/health`, async (_req, res) => res.json(await healthPayload(true)));
app.get(`${env.apiPrefix}/health/liveness`, (_req, res) => res.json({ success: true, status: 'ok', service: 'smartbus-backend', timestamp: new Date().toISOString(), uptime: Math.round(process.uptime()) }));
app.get(`${env.apiPrefix}/health/db`, async (_req, res) => {
  const database = await db.healthCheck();
  const ok = database.connected === true;
  return res.status(ok ? 200 : 503).json({ success: ok, status: ok ? 'ok' : 'degraded', database: { connected: ok, name: env.db.name, message: database.message || database.status } });
});
app.get(`${env.apiPrefix}/health/readiness`, async (_req, res) => {
  const database = await db.healthCheck();
  const ok = database.connected === true;
  return res.status(ok ? 200 : 503).json({ success: ok, status: ok ? 'ready' : 'not_ready', service: 'smartbus-backend', database: { connected: ok, name: env.db.name, message: database.message || database.status } });
});

function mount(prefix) {
  app.use(`${prefix}/auth`, authRoutes);
  app.use(`${prefix}/users`, userRoutes);
  app.use(`${prefix}/routes`, routeRoutes);
  app.use(`${prefix}/stops`, stopRoutes);
  app.use(`${prefix}/buses`, busRoutes);
  app.use(`${prefix}/bus`, busDomainRoutes);
  app.use(`${prefix}/chat`, chatRoutes);
  app.use(`${prefix}/chatbot`, chatRoutes);
  app.use(`${prefix}/reports`, reportRoutes);
  app.use(`${prefix}/analytics`, analyticsRoutes);
  app.use(`${prefix}/stats`, statsRoutes);
  app.use(`${prefix}/notifications`, notificationRoutes);
  app.use(prefix, tourismRoutes);
  app.use(`${prefix}/tourism`, tourismRoutes);
  app.use(prefix, reviewRoutes);
  app.use(`${prefix}/community`, communityRoutes);
  app.use(`${prefix}/trip-plans`, tripRoutes);
  app.use(`${prefix}/admin`, adminRoutes);
  app.use(`${prefix}/app`, appBffRoutes);
  app.use(`${prefix}/provinces`, provincesRoutes);
  app.use(`${prefix}/map`, mapRoutes);
  app.use(prefix, favoritesRoutes);
  app.use(`${prefix}/import`, importRoutes);
}

mount(env.apiPrefix);
// Deprecated aliases để frontend cũ không hỏng ngay; README yêu cầu chuyển sang /api/v1.
if (env.apiPrefix !== '/api') {
  app.get('/api/health', async (_req, res) => res.redirect(307, `${env.apiPrefix}/health`));
  mount('/api');
}

app.use(notFound);
app.use(errorHandler);

module.exports = app;
