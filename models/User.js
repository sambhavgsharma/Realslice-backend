import mongoose from 'mongoose';

const holdingSchema = new mongoose.Schema({
  propertyId: { type: String, required: true }, 
  sharesOwned: { type: Number, default: 0 }
});

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  walletAddress: { type: String, default: null }, // Blockchain wallet address
  wallet: { type: Number, default: 100000 },
  holdings: [holdingSchema]
}, { timestamps: true });

export default mongoose.model('User', userSchema);
