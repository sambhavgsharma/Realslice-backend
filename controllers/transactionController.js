import SellOrder from '../models/SellOrder.js';
import User from '../models/User.js';
import Transaction from '../models/Transaction.js';
import Property from '../models/Property.js';

export const buyFromOrder = async (req, res) => {
  try {
    const { orderId, sharesToBuy } = req.body;
    const buyerId = req.user.id;

    const order = await SellOrder.findById(orderId).populate('sellerId');
    if (!order) return res.status(404).json({ message: "Sell order not found" });
    if (sharesToBuy <= 0 || sharesToBuy > order.shares)
      return res.status(400).json({ message: "Invalid share quantity" });

    const totalCost = sharesToBuy * order.pricePerShare;
    const buyer = await User.findById(buyerId);

    
    if (buyer.wallet < totalCost)
      return res.status(400).json({ message: "Insufficient wallet balance" });

    // 1️⃣ Update buyer holdings
    const existingHolding = buyer.holdings.find(h =>
      h.propertyId === order.propertyId
    );
    if (existingHolding) existingHolding.sharesOwned += sharesToBuy;
    else buyer.holdings.push({ propertyId: order.propertyId, sharesOwned: sharesToBuy });

    buyer.wallet -= totalCost;
    await buyer.save();
    const seller = await User.findById(order.sellerId);

    // 2️⃣ Update seller holdings
    const sellerHolding = seller.holdings.find(h =>
      h.propertyId === order.propertyId
    );
    if (!sellerHolding || sellerHolding.sharesOwned < sharesToBuy)
      return res.status(400).json({ message: "Seller no longer owns enough shares" });

    if (sellerHolding.sharesOwned === 0) {
      seller.holdings = seller.holdings.filter(
        h => h.propertyId !== order.propertyId
      );
    }

    seller.wallet += totalCost;
    
    // 3️⃣ Save both users
    await buyer.save();
    await seller.save();
    // 4️⃣ Update order
    order.shares -= sharesToBuy;
    if (order.shares === 0) await order.deleteOne();
    else await order.save();

    // 5️⃣ Record transaction
    const transaction = await Transaction.create({
      userId: buyerId,
      propertyId: order.propertyId,
      type: 'buy',
      shares: sharesToBuy,
      price: order.pricePerShare
    });

    // 6️⃣ Update property price based on market activity
    try {
      const property = await Property.findOne({ propertyId: order.propertyId });
      if (property) {
        // Get recent transactions for price calculation
        const recentTransactions = await Transaction.find({ propertyId: order.propertyId })
          .sort({ timestamp: -1 })
          .limit(20);

        if (recentTransactions.length === 0) {
          console.log(`No recent transactions found for property ${order.propertyId}. Price update skipped.`);
        } else if (recentTransactions.length < 5) {
          console.log(`Insufficient transaction data for property ${order.propertyId} (${recentTransactions.length} transactions). Price update skipped for stability.`);
        } else {
          // Calculate demand and supply
          const buyTransactions = recentTransactions.filter(t => t.type === 'buy');
          const sellTransactions = recentTransactions.filter(t => t.type === 'sell');
          const demand = buyTransactions.reduce((sum, t) => sum + t.shares, 0);
          const supply = sellTransactions.reduce((sum, t) => sum + t.shares, 0);

          // Calculate market pressure
          const delta = (demand - supply) / (demand + supply);

          // Calculate volatility
          const prices = recentTransactions.map(t => t.price);
          const mean = prices.reduce((sum, price) => sum + price, 0) / prices.length;
          const variance = prices.reduce((sum, price) => sum + Math.pow(price - mean, 2), 0) / prices.length;
          const standardDeviation = Math.sqrt(variance);
          const volatility = mean > 0 ? standardDeviation / mean : 0;

          // Calculate new price
          const alpha = 0.05;
          const beta = 0.02;
          const previousPrice = recentTransactions[0].price;
          const priceChange = previousPrice * (1 + alpha * delta + beta * volatility);

          // Apply safety bounds (±10%)
          const minPrice = previousPrice * 0.9;
          const maxPrice = previousPrice * 1.1;
          const newPrice = Math.max(minPrice, Math.min(maxPrice, priceChange));

          // Update property price
          const oldPrice = property.currentPrice;
          property.currentPrice = newPrice;
          await property.save();
          
          console.log(`Price updated for property ${order.propertyId}: ₹${oldPrice} → ₹${newPrice} (${((newPrice - oldPrice) / oldPrice * 100).toFixed(2)}%)`);
        }
      }
    } catch (priceUpdateError) {
      // Don't fail the transaction if price update fails
      console.error(`Price update failed for property ${order.propertyId}:`, priceUpdateError.message);
    }

    res.status(201).json({
      message: "Purchase completed successfully",
      transaction
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const createSellOrder = async (req, res) => {
  try {
    const { propertyId, shares, pricePerShare } = req.body;
    const userId = req.user.id;
    console.log(userId);
    const user = await User.findById(userId);
    const holding = user.holdings.find(h => h.propertyId === propertyId);
    console.log(user);
    if (!holding || holding.sharesOwned < shares)
      return res.status(400).json({ message: "Not enough shares to sell" });

    // Lock the shares by temporarily reducing from user's holdings
    holding.sharesOwned -= shares;
    if (holding.sharesOwned === 0) {
      user.holdings = user.holdings.filter(h => h.propertyId !== propertyId);
    }
    await user.save();

    // Create a new sell order
    const order = await SellOrder.create({
      propertyId,
      sellerId: userId,
      shares,
      pricePerShare
    });

    // Update property price based on new sell order (increased supply)
    try {
      const property = await Property.findOne({ propertyId });
      if (property) {
        // Get recent transactions for price calculation
        const recentTransactions = await Transaction.find({ propertyId })
          .sort({ timestamp: -1 })
          .limit(20);

        if (recentTransactions.length === 0) {
          console.log(`No recent transactions found for property ${propertyId}. Price update skipped.`);
        } else if (recentTransactions.length < 5) {
          console.log(`Insufficient transaction data for property ${propertyId} (${recentTransactions.length} transactions). Price update skipped for stability.`);
        } else {
          // Calculate demand and supply (including this new sell order as increased supply)
          const buyTransactions = recentTransactions.filter(t => t.type === 'buy');
          const sellTransactions = recentTransactions.filter(t => t.type === 'sell');
          const demand = buyTransactions.reduce((sum, t) => sum + t.shares, 0);
          const supply = sellTransactions.reduce((sum, t) => sum + t.shares, 0) + shares; // Add new sell order

          // Calculate market pressure
          const delta = (demand - supply) / (demand + supply);

          // Calculate volatility
          const prices = recentTransactions.map(t => t.price);
          const mean = prices.reduce((sum, price) => sum + price, 0) / prices.length;
          const variance = prices.reduce((sum, price) => sum + Math.pow(price - mean, 2), 0) / prices.length;
          const standardDeviation = Math.sqrt(variance);
          const volatility = mean > 0 ? standardDeviation / mean : 0;

          // Calculate new price
          const alpha = 0.05;
          const beta = 0.02;
          const previousPrice = recentTransactions[0].price;
          const priceChange = previousPrice * (1 + alpha * delta + beta * volatility);

          // Apply safety bounds (±10%)
          const minPrice = previousPrice * 0.9;
          const maxPrice = previousPrice * 1.1;
          const newPrice = Math.max(minPrice, Math.min(maxPrice, priceChange));

          // Update property price
          const oldPrice = property.currentPrice;
          property.currentPrice = newPrice;
          await property.save();
          
          console.log(`Price updated for property ${propertyId}: ₹${oldPrice} → ₹${newPrice} (${((newPrice - oldPrice) / oldPrice * 100).toFixed(2)}%)`);
        }
      }
    } catch (priceUpdateError) {
      // Don't fail the sell order creation if price update fails
      console.error(`Price update failed for property ${propertyId}:`, priceUpdateError.message);
    }

    res.status(201).json({
      message: "Sell order created successfully",
      order
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
