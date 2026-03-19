import express from 'express';
import cors from 'cors';

const app = express();
const PORT = process.env.PORT || 3200;

app.use(cors());
app.use(express.json());

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// TODO: Mount survey realtime-stats routes here
// import { realtimeStatsRouter } from './routes/realtimeStats';
// app.use('/api/surveys', realtimeStatsRouter);

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

export default app;
