import express from "express";
import { protect } from "../middleware/auth.js";
import { createTechnicianProfile, getAllTechnicians, getTechnicianProfile, updateTechnicianProfile } from "../controllers/technicianProfileController.js";

const router = express.Router();

router.post('/profile', protect, createTechnicianProfile);
router.get('/profile/:userId', protect, getTechnicianProfile);
router.put('/profile', protect, updateTechnicianProfile);
router.get('/', getAllTechnicians);

export default router;
