import express from "express";
import { protect } from "../middleware/auth.js";
import {
  createRepairRequest,
  getRepairRequests,
  getRepairRequestById,
  updateRepairRequest,
  deleteRepairRequest
} from "../controllers/repairRequestController.js";

const router = express.Router();

router.post('/', protect, createRepairRequest);
router.get('/', protect, getRepairRequests);
router.get('/:id', protect, getRepairRequestById);
router.put('/:id', protect, updateRepairRequest);
router.delete('/:id', protect, deleteRepairRequest);

export default router;