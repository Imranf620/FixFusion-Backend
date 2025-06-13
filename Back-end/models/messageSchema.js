import mongoose from "mongoose";

const messageSchema = new mongoose.Schema({
    chatId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Chat',
      required: true
    },
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    content: {
      type: String,
      required: [true, 'Message content is required'],
      maxlength: [1000, 'Message cannot exceed 1000 characters']
    },
    messageType: {
      type: String,
      enum: ['text', 'image', 'file'],
      default: 'text'
    },
    attachments: [{
      url: String,
      type: String,
      size: Number,
      originalName: String
    }],
    isRead: {
      type: Boolean,
      default: false
    },
    readAt: Date,
    isEdited: {
      type: Boolean,
      default: false
    },
    editedAt: Date
  }, {
    timestamps: true
  });

  
  const Message = mongoose.model('Message', messageSchema);
  export default Message