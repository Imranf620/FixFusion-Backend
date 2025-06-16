import Chat from '../models/chatSchema.js';
import Message from '../models/messageSchema.js';
import RepairRequest from '../models/repairRequestSchema.js';
import Bid from '../models/bidSchema.js';
import { apiResponse } from '../utils/apiResponse.js';

export const createChat = async (req, res) => {
  try {
    const { repairRequestId, bidId, technicianId } = req.body;
    
    // Verify the repair request and bid
    const repairRequest = await RepairRequest.findById(repairRequestId);
    const bid = await Bid.findById(bidId);
    
    if (!repairRequest || !bid) {
      return apiResponse(res, {
        statusCode: 404,
        message: 'Repair request or bid not found'
      });
    }

    // Check if chat already exists
    const existingChat = await Chat.findOne({ repairRequestId, bidId })
      .populate('participants.userId', 'name email profileImage')
      .populate('repairRequestId', 'title status')
      .populate('bidId', 'amount status');

    if (existingChat) {
      return apiResponse(res, {
        statusCode: 200,
        message: 'Chat retrieved successfully',
        data: existingChat
      });
    }

    // Create new chat
    const chat = await Chat.create({
      participants: [
        { userId: repairRequest.customerId, role: 'customer' },
        { userId: technicianId, role: 'technician' }
      ],
      repairRequestId,
      bidId,
      isActive: true
    });

    await chat.populate([
      { path: 'participants.userId', select: 'name email profileImage' },
      { path: 'repairRequestId', select: 'title status' },
      { path: 'bidId', select: 'amount status' }
    ]);

    return apiResponse(res, {
      statusCode: 201,
      message: 'Chat created successfully',
      data: chat
    });
  } catch (error) {
    return apiResponse(res, {
      statusCode: 500,
      message: 'Error creating chat',
      error: error.message
    });
  }
};

export const getUserChats = async (req, res) => {
  try {
    const chats = await Chat.find({
      'participants.userId': req.user._id,
      isActive: true
    })
    .populate('participants.userId', 'name email profileImage')
    .populate('repairRequestId', 'title status deviceInfo')
    .populate('bidId', 'amount status')
    .populate({
      path: 'participants.userId',
      populate: {
        path: 'technicianProfile',
        model: 'TechnicianProfile',
        select: 'rating specializations'
      }
    })
    .sort({ 'lastMessage.timestamp': -1 });

    // Get unread message count for each chat
    const chatsWithUnreadCount = await Promise.all(
      chats.map(async (chat) => {
        const unreadCount = await Message.countDocuments({
          chatId: chat._id,
          senderId: { $ne: req.user._id },
          isRead: false
        });
        
        return {
          ...chat.toObject(),
          unreadCount
        };
      })
    );

    return apiResponse(res, {
      statusCode: 200,
      message: 'Chats retrieved successfully',
      data: chatsWithUnreadCount
    });
  } catch (error) {
    return apiResponse(res, {
      statusCode: 500,
      message: 'Error fetching chats',
      error: error.message
    });
  }
};

export const sendMessage = async (req, res) => {
  try {
    const { chatId } = req.params;
    const { content, messageType = 'text', attachments = [] } = req.body;
    
    const chat = await Chat.findById(chatId)
      .populate('participants.userId', 'name profileImage');
    
    if (!chat) {
      return apiResponse(res, {
        statusCode: 404,
        message: 'Chat not found'
      });
    }

    // Check if user is participant
    const isParticipant = chat.participants.some(
      p => p.userId._id.toString() === req.user._id.toString()
    );
    
    if (!isParticipant) {
      return apiResponse(res, {
        statusCode: 403,
        message: 'Not authorized to send message in this chat'
      });
    }

    const message = await Message.create({
      chatId,
      senderId: req.user._id,
      content,
      messageType,
      attachments
    });

    // Update chat's last message
    await Chat.findByIdAndUpdate(chatId, {
      lastMessage: {
        content,
        senderId: req.user._id,
        timestamp: new Date()
      }
    });

    await message.populate('senderId', 'name profileImage');

    // Get the recipient for real-time messaging
    const recipient = chat.participants.find(
      p => p.userId._id.toString() !== req.user._id.toString()
    );

    // Emit real-time message
    const io = req.app.get('io');
    if (io && recipient) {
      io.to(`user_${recipient.userId._id}`).emit('new_message', {
        chatId,
        message,
        sender: {
          _id: req.user._id,
          name: req.user.name,
          profileImage: req.user.profileImage
        }
      });
    }

    return apiResponse(res, {
      statusCode: 201,
      message: 'Message sent successfully',
      data: message
    });
  } catch (error) {
    return apiResponse(res, {
      statusCode: 500,
      message: 'Error sending message',
      error: error.message
    });
  }
};

export const getChatMessages = async (req, res) => {
  try {
    const { chatId } = req.params;
    const { page = 1, limit = 50 } = req.query;
    
    const chat = await Chat.findById(chatId);
    if (!chat) {
      return apiResponse(res, {
        statusCode: 404,
        message: 'Chat not found'
      });
    }

    // Check if user is participant
    const isParticipant = chat.participants.some(
      p => p.userId.toString() === req.user._id.toString()
    );
    
    if (!isParticipant) {
      return apiResponse(res, {
        statusCode: 403,
        message: 'Not authorized to view messages in this chat'
      });
    }

    const messages = await Message.find({ chatId })
      .populate('senderId', 'name profileImage')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    // Mark messages as read
    await Message.updateMany(
      { chatId, senderId: { $ne: req.user._id }, isRead: false },
      { isRead: true, readAt: new Date() }
    );

    return apiResponse(res, {
      statusCode: 200,
      message: 'Messages retrieved successfully',
      data: messages.reverse() // Reverse to show oldest first
    });
  } catch (error) {
    console.log('err', error)
    return apiResponse(res, {
      statusCode: 500,
      message: 'Error fetching messages',
      error: error.message
    });
  }
};

export const getChatById = async (req, res) => {
  try {
    const { chatId } = req.params;
    
    const chat = await Chat.findById(chatId)
      .populate('participants.userId', 'name email profileImage')
      .populate('repairRequestId', 'title description status deviceInfo')
      .populate('bidId', 'amount status estimatedTime description warranty')
      .populate({
        path: 'participants.userId',
        populate: {
          path: 'technicianProfile',
          model: 'TechnicianProfile',
          select: 'rating experience specializations bio'
        }
      });

    if (!chat) {
      return apiResponse(res, {
        statusCode: 404,
        message: 'Chat not found'
      });
    }

    // Check if user is participant
    const isParticipant = chat.participants.some(
      p => p.userId._id.toString() === req.user._id.toString()
    );
    
    if (!isParticipant) {
      return apiResponse(res, {
        statusCode: 403,
        message: 'Not authorized to view this chat'
      });
    }

    return apiResponse(res, {
      statusCode: 200,
      message: 'Chat retrieved successfully',
      data: chat
    });
  } catch (error) {
    return apiResponse(res, {
      statusCode: 500,
      message: 'Error fetching chat',
      error: error.message
    });
  }
};