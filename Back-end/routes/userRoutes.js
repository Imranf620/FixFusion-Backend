import { fetchMe, login, logout, signup, updateProfile } from "../controllers/userController.js";
import express from "express"
import { protect } from "../middleware/auth.js";
const router = express.Router()

router.post('/signup', signup)
router.post('/login', login)
router.get('/me',protect, fetchMe)
router.put('/update',protect, updateProfile)
router.post('/logout', protect, logout)


export default router

