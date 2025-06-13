import express from "express";
import { protect } from "../middleware/auth.js";
import {
  createChat,
  getUserChats,
  sendMessage,
  getChatMessages
} from "../controllers/chatController.js";

const router = express.Router();

router.post('/', protect, createChat);
router.get('/', protect, getUserChats);
router.post('/:chatId/messages', protect, sendMessage);
router.get('/:chatId/messages', protect, getChatMessages);

export default router;
