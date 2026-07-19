import { Router } from 'express';
import { getTelemetryDebug } from '../controllers/debugController.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.use(requireAuth);

router.get('/telemetry', getTelemetryDebug);

export default router;
