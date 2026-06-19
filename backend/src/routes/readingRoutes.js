import { Router } from 'express';
import { latestReading, historyReadings, listAlerts } from '../controllers/readingController.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.use(requireAuth);

router.get('/alerts', listAlerts);
router.get('/:id/latest', latestReading);
router.get('/:id/history', historyReadings);

export default router;
