import User from '../models/User.js';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

// REGISTER
export const registerUser = async (req, res) => {
  try {
    const { name, email, password } = req.body;
    const existing = await User.findOne({ email });
    if (existing) return res.status(400).json({ message: "User already exists" });

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({ name, email, password: hashedPassword });
    res.status(201).json({ message: "User registered successfully", user });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// LOGIN
export const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: "Invalid email or password" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: "Invalid credentials" });

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '1d' });
    res.json({ message: "Login successful", token });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GET USER PROFILE
export const getUserProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');

    if (!user) return res.status(404).json({ message: "User not found" });
    // Get property details for each holding
    const Property = (await import('../models/Property.js')).default;
    const holdingsWithDetails = await Promise.all(
      user.holdings.map(async (holding) => {
        const property = await Property.findOne({ propertyId: holding.propertyId });
        return {
          propertyDetails: {
            propertyId: holding.propertyId,
            name: property?.name || 'Unknown Property',
            location: property?.location || 'Unknown Location',
            currentPrice: property?.currentPrice || 0
          },
          sharesOwned: holding.sharesOwned,
          totalValue: holding.sharesOwned * (property?.currentPrice || 0)
        };
      })
    );

    res.json({
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
      wallet: user.wallet,
      walletAddress: user.walletAddress,
      holdings: holdingsWithDetails,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
      }
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// LINK WALLET ADDRESS
export const linkWalletAddress = async (req, res) => {
  try {
    const { walletAddress } = req.body;
    
    if (!walletAddress || typeof walletAddress !== 'string') {
      return res.status(400).json({ message: "Valid wallet address required" });
    }

    const user = await User.findByIdAndUpdate(
      req.user.id,
      { walletAddress },
      { new: true }
    ).select('-password');

    res.json({ 
      message: "Wallet linked successfully", 
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        walletAddress: user.walletAddress
      }
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};