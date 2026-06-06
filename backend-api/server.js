require('dotenv').config();
const app = require('./app');
const env = require('./config/env');

app.listen(env.port, () => {
  console.log(`SmartBus Travel Connect API running at http://localhost:${env.port}${env.apiPrefix}`);
});
