const app=require('./app'),env=require('./config/env'),{closePool}=require('./config/db');
const server=app.listen(env.port,'0.0.0.0',()=>console.log(`SmartBus: http://localhost:${env.port}`));
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>{server.close(()=>closePool().finally(()=>process.exit(0)));setTimeout(()=>process.exit(1),10000).unref();});
