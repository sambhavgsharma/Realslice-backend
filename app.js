import express from 'express';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import cors from 'cors';
import userRoutes from './routes/userRoutes.js';
import propertyRoutes from './routes/propertyRoutes.js';
import transactionRoutes from './routes/transactionRoutes.js';
import priceRoutes from './routes/priceRoutes.js';

dotenv.config();

const app = express();
app.use(express.json());

// CORS Configuration
const corsOptions = {
  origin: process.env.FRONTEND_URL || 'http://localhost:3001',
  credentials: true,
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB connected"))
  .catch(err => console.error("❌ DB connection failed:", err));

// Routes
app.use('/api/users', userRoutes);
app.use('/api/properties', propertyRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/properties', priceRoutes);

app.get('/', (req, res) => {
  res.send("🏠 Real Estate Share Market API is running...");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
