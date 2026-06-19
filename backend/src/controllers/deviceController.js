import { validationResult } from 'express-validator';
import Device from '../models/Device.js';

function checkValidation(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ error: errors.array()[0].msg, details: errors.array() });
    return false;
  }
  return true;
}

export async function createDevice(req, res) {
  if (!checkValidation(req, res)) return;

  const { deviceId, name, location } = req.body;

  const existing = await Device.findOne({ deviceId });
  if (existing) {
    return res.status(409).json({ error: 'deviceId already exists' });
  }

  const device = await Device.create({
    deviceId,
    name,
    location,
    owner: req.user.id,
    apiKey: Device.generateApiKey(),
    mqttUsername: deviceId,
  });

  res.status(201).json({
    device,
    provisioning: {
      note:
        'Đăng ký thiết bị này trên MQTT broker bằng lệnh sau, rồi cấu hình device-simulator hoặc ' +
        'wokwi/sketch.ino với cùng deviceId + mqttPassword:',
      command: `bash mosquitto/config/add-device.sh ${deviceId} <mqttPassword tự chọn>`,
    },
  });
}

export async function listDevices(req, res) {
  const devices = await Device.find({ owner: req.user.id }).sort({ createdAt: -1 });
  res.json({ devices });
}

export async function getDevice(req, res) {
  const device = await Device.findOne({ _id: req.params.id, owner: req.user.id });
  if (!device) return res.status(404).json({ error: 'Device not found' });
  res.json({ device });
}

export async function updateDevice(req, res) {
  if (!checkValidation(req, res)) return;

  const device = await Device.findOne({ _id: req.params.id, owner: req.user.id });
  if (!device) return res.status(404).json({ error: 'Device not found' });

  const { name, location, alertThresholds } = req.body;
  if (name !== undefined) device.name = name;
  if (location !== undefined) device.location = location;
  if (alertThresholds !== undefined) {
    device.alertThresholds = { ...device.alertThresholds.toObject(), ...alertThresholds };
  }

  await device.save();
  res.json({ device });
}

export async function deleteDevice(req, res) {
  const device = await Device.findOneAndDelete({ _id: req.params.id, owner: req.user.id });
  if (!device) return res.status(404).json({ error: 'Device not found' });
  res.status(204).end();
}

export async function regenerateApiKey(req, res) {
  const device = await Device.findOne({ _id: req.params.id, owner: req.user.id });
  if (!device) return res.status(404).json({ error: 'Device not found' });

  device.apiKey = Device.generateApiKey();
  await device.save();
  res.json({ device });
}
