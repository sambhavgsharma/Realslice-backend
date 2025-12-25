import Property from '../models/Property.js';
import SellOrder from '../models/SellOrder.js';
import User from '../models/User.js';
// Create (List a property)
export const createProperty = async (req, res) => {
  try {
    const { name, location, description, currentPrice, totalShares, blockchainId } = req.body;
    const availableShares = totalShares;
    const property = await Property.create({
      name,
      location,
      description,
      currentPrice,
      totalShares,
      availableShares,
      owner: req.user.id,
      blockchainId
    });

    const user = await User.findById(req.user.id);

    if(!user){
      return res.status(404).json({ message: "User not found" });
    }

    user.holdings.push({ propertyId: property.propertyId, sharesOwned: property.availableShares });
    await user.save();
    res.status(201).json({
      message: "Property created successfully",
      property: {
        propertyId: property.propertyId,
        blockchainId: property.blockchainId,
        name: property.name,
        location: property.location,
        description: property.description,
        currentPrice: property.currentPrice,
        totalShares: property.totalShares,
        availableShares: property.availableShares,
        owner: req.user.id
      }
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Get all properties
export const getProperties = async (req, res) => {
  try {
    const properties = await Property.find().populate('owner', 'name email');
    res.json(properties);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Get property by ID
export const getPropertyById = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Find property by auto-generated propertyId (PROP00001 format)
    const property = await Property.findOne({ propertyId: id }).populate('owner', 'name email');
    
    if (!property) {
      return res.status(404).json({ message: "Property not found" });
    }

    res.json({
      property: {
        propertyId: property.propertyId,
        blockchainId: property.blockchainId,
        name: property.name,
        location: property.location,
        description: property.description,
        currentPrice: property.currentPrice,
        totalShares: property.totalShares,
        availableShares: property.availableShares,
        isListed: property.isListed,
        owner: {
          name: property.owner.name,
          email: property.owner.email
        },
        createdAt: property.createdAt,
        updatedAt: property.updatedAt
      }
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Get sell orders for a property
export const getPropertySellOrders = async (req, res) => {
  try {
    const { id } = req.params;
    
    // First verify the property exists
    const property = await Property.findOne({ propertyId: id });
    if (!property) {
      return res.status(404).json({ message: "Property not found" });
    }

    // Get all active sell orders for this property
    const sellOrders = await SellOrder.find({ propertyId: id })
      .populate('sellerId', 'name email')
      .sort({ pricePerShare: 1, timestamp: 1 }); // Sort by price (ascending) then by timestamp

    res.json({
      propertyId: id,
      propertyName: property.name,
      sellOrders: sellOrders.map(order => ({
        orderId: order._id,
        seller: {
          name: order.sellerId.name,
          email: order.sellerId.email
        },
        shares: order.shares,
        pricePerShare: order.pricePerShare,
        totalValue: order.shares * order.pricePerShare,
        timestamp: order.timestamp
      }))
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
