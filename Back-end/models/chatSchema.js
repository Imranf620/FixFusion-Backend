import mongoose from "mongoose";

const chatSchema = new mongoose.Schema({
    participants: [{
      userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
      },
      role: {
        type: String,
        enum: ['customer', 'technician']
      }
    }],
    repairRequestId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'RepairRequest',
      required: true
    },
    bidId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Bid',
      required: true
    },
    isActive: {
      type: Boolean,
      default: true
    },
    lastMessage: {
      content: String,
      senderId: mongoose.Schema.Types.ObjectId,
      timestamp: Date
    }
  }, {
    timestamps: true
  });
  
  
    const Chat = mongoose.model('Chat', chatSchema);

    export default Chat


  