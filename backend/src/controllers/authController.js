import { validationResult } from 'express-validator';
import User from '../models/User.js';
import RefreshToken from '../models/RefreshToken.js';
import {
  signAccessToken,
  generateRefreshTokenValue,
  hashToken,
  refreshExpiryDate,
} from '../utils/jwt.js';

const MAX_FAILED_ATTEMPTS = 5;
const LOCK_DURATION_MS = 15 * 60 * 1000;

function checkValidation(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ error: errors.array()[0].msg, details: errors.array() });
    return false;
  }
  return true;
}

async function issueTokenPair(user) {
  const accessToken = signAccessToken(user);
  const refreshTokenValue = generateRefreshTokenValue();
  await RefreshToken.create({
    user: user._id,
    tokenHash: hashToken(refreshTokenValue),
    expiresAt: refreshExpiryDate(),
  });
  return { accessToken, refreshToken: refreshTokenValue };
}

export async function register(req, res) {
  if (!checkValidation(req, res)) return;

  const { name, email, password } = req.body;
  const existing = await User.findOne({ email: email.toLowerCase() });
  if (existing) {
    return res.status(409).json({ error: 'Email already registered' });
  }

  const user = new User({ name, email });
  await user.setPassword(password);
  await user.save();

  const tokens = await issueTokenPair(user);
  res.status(201).json({ user: user.toSafeJSON(), ...tokens });
}

export async function login(req, res) {
  if (!checkValidation(req, res)) return;

  const { email, password } = req.body;
  const user = await User.findOne({ email: email.toLowerCase() });
  if (!user) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  if (user.isLocked()) {
    return res.status(423).json({ error: 'Account temporarily locked due to too many failed attempts' });
  }

  const valid = await user.verifyPassword(password);
  if (!valid) {
    user.failedLoginAttempts += 1;
    if (user.failedLoginAttempts >= MAX_FAILED_ATTEMPTS) {
      user.lockedUntil = new Date(Date.now() + LOCK_DURATION_MS);
      user.failedLoginAttempts = 0;
    }
    await user.save();
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  user.failedLoginAttempts = 0;
  user.lockedUntil = null;
  await user.save();

  const tokens = await issueTokenPair(user);
  res.json({ user: user.toSafeJSON(), ...tokens });
}

export async function refresh(req, res) {
  const { refreshToken } = req.body;
  if (!refreshToken) {
    return res.status(400).json({ error: 'refreshToken is required' });
  }

  const tokenHash = hashToken(refreshToken);
  const stored = await RefreshToken.findOne({ tokenHash });

  if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
    return res.status(401).json({ error: 'Invalid or expired refresh token' });
  }

  const user = await User.findById(stored.user);
  if (!user) {
    return res.status(401).json({ error: 'User not found' });
  }

  // Token rotation: thu hồi token cũ, cấp token mới — giảm thiệt hại nếu token bị rò rỉ
  stored.revokedAt = new Date();
  await stored.save();

  const tokens = await issueTokenPair(user);
  res.json({ user: user.toSafeJSON(), ...tokens });
}

export async function logout(req, res) {
  const { refreshToken } = req.body;
  if (refreshToken) {
    await RefreshToken.updateOne(
      { tokenHash: hashToken(refreshToken) },
      { $set: { revokedAt: new Date() } }
    );
  }
  res.status(204).end();
}

export async function me(req, res) {
  const user = await User.findById(req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ user: user.toSafeJSON() });
}
