import express from 'express';
import { registerUser, loginUser, getUserProfile, linkWalletAddress } from '../controllers/userController.js';
import { protect } from '../middlewares/authMiddleware.js';
const router = express.Router();

router.post('/register', registerUser);
router.post('/login', loginUser);
router.get('/me', protect, getUserProfile);
router.post('/link-wallet', protect, linkWalletAddress);

export default router;
