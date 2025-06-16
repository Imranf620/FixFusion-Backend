import express from "express";
import { protect } from "../middleware/auth.js";
import {
  createChat,
  getUserChats,
  sendMessage,
  getChatMessages,
  getChatById
} from "../controllers/chatController.js";

const router = express.Router();

router.post('/', protect, createChat);
router.get('/', protect, getUserChats);
router.get('/:chatId', protect, getChatById); // Add this route
router.post('/:chatId/messages', protect, sendMessage);
router.get('/:chatId/messages', protect, getChatMessages);

export default router;