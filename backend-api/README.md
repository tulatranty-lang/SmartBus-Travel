# SmartBus Backend API

## Run

```bash
npm ci
copy .env.example .env
npm run check
npm start
```

Base URL: `http://localhost:5000/api/v1`.

## Test

```bash
npm test
npm run test:coverage
```

## Architecture rule

Controller → Service → Repository → SQL Server. Không query database trực tiếp trong controller.
