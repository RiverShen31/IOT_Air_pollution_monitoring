import mongoose from 'mongoose';

export async function connectDB() {
  const uri = process.env.MONGO_URI;
  if (!uri) throw new Error('MONGO_URI is not set');

  mongoose.connection.on('connected', () => console.log('[mongo] connected'));
  mongoose.connection.on('error', (err) => console.error('[mongo] error:', err.message));

  await mongoose.connect(uri);
  return mongoose.connection;
}
