import express from 'express';
import { getSurveyRealtimeStats } from '../services/realtimeStatsService';

const router = express.Router();

// GET /api/surveys/:id/realtime-stats
router.get('/:id/realtime-stats', async (req, res) => {
  try {
    const surveyId = req.params.id;

    const stats = await getSurveyRealtimeStats(surveyId);

    if (stats === null) {
      return res.status(404).json({
        error: 'Survey not found',
      });
    }

    return res.json(stats);
  } catch (error) {
    console.error('Failed to get realtime stats', error);
    return res.status(500).json({
      error: 'Internal server error',
    });
  }
});

export { router as realtimeStatsRouter };
