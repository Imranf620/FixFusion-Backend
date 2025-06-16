import express from 'express';
import { 
  getAllTransactions, 
  getTransactionById, 
  createPayment 
} from '../controllers/transactionController.js';
import { protect } from '../middleware/auth.js';
const router = express.Router();

router.get('/', protect, getAllTransactions);

router.get('/:transactionId',protect, getTransactionById);

router.post('/payment',protect, createPayment);

export default router;