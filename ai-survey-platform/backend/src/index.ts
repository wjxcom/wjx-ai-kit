import express from 'express';
import cors from 'cors';
import { realtimeStatsRouter } from './routes/realtimeStats';

const app = express();
const PORT = process.env.PORT || 3200;

app.use(cors());
app.use(express.json());

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 问卷实时统计 API
app.use('/api/surveys', realtimeStatsRouter);

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

export default app;
