import { Router } from 'express';
import { latestReading, historyReadings, exportReadingsCsv, listAlerts } from '../controllers/readingController.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.use(requireAuth);

router.get('/alerts', listAlerts);
router.get('/:id/latest', latestReading);
router.get('/:id/history', historyReadings);
router.get('/:id/history/export', exportReadingsCsv);

export default router;
