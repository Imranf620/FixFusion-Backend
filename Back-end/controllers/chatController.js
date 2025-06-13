import Chat from '../models/chatSchema.js';
import Message from '../models/messageSchema.js';

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
    const existingChat = await Chat.findOne({ repairRequestId, bidId });
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

    await chat.populate('participants.userId', 'name email profileImage');

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
    .populate('repairRequestId', 'title status')
    .sort({ 'lastMessage.timestamp': -1 });

    return apiResponse(res, {
      statusCode: 200,
      message: 'Chats retrieved successfully',
      data: chats
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
    return apiResponse(res, {
      statusCode: 500,
      message: 'Error fetching messages',
      error: error.message
    });
  }
};