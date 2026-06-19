import { Router } from 'express';
import { requireApiKey } from '../middleware/auth.js';
import { ingestTelemetry } from '../services/mqttIngestService.js';

// HTTP fallback ingest: dùng khi thiết bị không/chưa kết nối được MQTT.
// Xác thực bằng header x-api-key (mỗi Device có 1 API key riêng, xem Device.apiKey).
const router = Router();

router.post('/', requireApiKey, async (req, res) => {
  try {
    const io = req.app.get('io');
    const reading = await ingestTelemetry(req.device, req.body, io);
    res.status(201).json({ reading });
  } catch (err) {
    res.status(err.status || 400).json({ error: err.message });
  }
});

export default router;
