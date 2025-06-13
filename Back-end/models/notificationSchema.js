import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    type: {
      type: String,
      required: true,
      enum: [
        "new_bid",
        "bid_accepted",
        "bid_rejected",
        "new_message",
        "job_completed",
        "payment_received",
        "review_received",
        "system_update",
        "subscription_expiry",
        "profile_approved",
        "profile_rejected",
      ],
    },
    title: {
      type: String,
      required: true,
      maxlength: [100, "Title cannot exceed 100 characters"],
    },
    message: {
      type: String,
      required: true,
      maxlength: [500, "Message cannot exceed 500 characters"],
    },
    data: {
      repairRequestId: mongoose.Schema.Types.ObjectId,
      bidId: mongoose.Schema.Types.ObjectId,
      chatId: mongoose.Schema.Types.ObjectId,
      url: String,
    },
    isRead: {
      type: Boolean,
      default: false,
    },
    readAt: Date,
    priority: {
      type: String,
      enum: ["low", "medium", "high"],
      default: "medium",
    },
  },
  {
    timestamps: true,
  }
);

const Notification = mongoose.model("Notification", notificationSchema);

export default Notification;
