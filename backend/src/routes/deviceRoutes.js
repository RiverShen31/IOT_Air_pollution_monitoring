import { Router } from 'express';
import { body } from 'express-validator';
import {
  createDevice,
  listDevices,
  getDevice,
  updateDevice,
  deleteDevice,
  regenerateApiKey,
} from '../controllers/deviceController.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.use(requireAuth);

router.post(
  '/',
  [
    body('deviceId').trim().isLength({ min: 3, max: 64 }).withMessage('deviceId must be 3-64 chars'),
    body('name').trim().isLength({ min: 2, max: 100 }).withMessage('name must be 2-100 chars'),
    body('location').optional().trim().isLength({ max: 200 }),
  ],
  createDevice
);

router.get('/', listDevices);
router.get('/:id', getDevice);
router.patch('/:id', updateDevice);
router.delete('/:id', deleteDevice);
router.post('/:id/api-key/regenerate', regenerateApiKey);

export default router;
