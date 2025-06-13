import Notification from '../models/notificationSchema.js';
import { apiResponse } from '../utils/apiResponse.js';

export const getUserNotifications = async (req, res) => {
  try {
    const { page = 1, limit = 20, isRead, type } = req.query;
    const filter = { userId: req.user._id };
    
    if (isRead !== undefined) {
      filter.isRead = isRead === 'true';
    }
    
    if (type) {
      filter.type = type;
    }

    const notifications = await Notification.find(filter)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Notification.countDocuments(filter);
    const unreadCount = await Notification.countDocuments({ 
      userId: req.user._id, 
      isRead: false 
    });

    return apiResponse(res, {
      statusCode: 200,
      message: 'Notifications retrieved successfully',
      data: {
        notifications,
        unreadCount,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    return apiResponse(res, {
      statusCode: 500,
      message: 'Error fetching notifications',
      error: error.message
    });
  }
};

export const markNotificationAsRead = async (req, res) => {
  try {
    const { notificationId } = req.params;
    
    const notification = await Notification.findById(notificationId);
    
    if (!notification) {
      return apiResponse(res, {
        statusCode: 404,
        message: 'Notification not found'
      });
    }

    // Check if notification belongs to the user
    if (notification.userId.toString() !== req.user._id.toString()) {
      return apiResponse(res, {
        statusCode: 403,
        message: 'Not authorized to access this notification'
      });
    }

    notification.isRead = true;
    notification.readAt = new Date();
    await notification.save();

    return apiResponse(res, {
      statusCode: 200,
      message: 'Notification marked as read',
      data: notification
    });
  } catch (error) {
    return apiResponse(res, {
      statusCode: 500,
      message: 'Error updating notification',
      error: error.message
    });
  }
};

export const markAllNotificationsAsRead = async (req, res) => {
  try {
    await Notification.updateMany(
      { userId: req.user._id, isRead: false },
      { 
        isRead: true, 
        readAt: new Date() 
      }
    );

    return apiResponse(res, {
      statusCode: 200,
      message: 'All notifications marked as read'
    });
  } catch (error) {
    return apiResponse(res, {
      statusCode: 500,
      message: 'Error updating notifications',
      error: error.message
    });
  }
};

export const deleteNotification = async (req, res) => {
  try {
    const { notificationId } = req.params;
    
    const notification = await Notification.findById(notificationId);
    
    if (!notification) {
      return apiResponse(res, {
        statusCode: 404,
        message: 'Notification not found'
      });
    }

    // Check if notification belongs to the user
    if (notification.userId.toString() !== req.user._id.toString()) {
      return apiResponse(res, {
        statusCode: 403,
        message: 'Not authorized to delete this notification'
      });
    }

    await Notification.findByIdAndDelete(notificationId);

    return apiResponse(res, {
      statusCode: 200,
      message: 'Notification deleted successfully'
    });
  } catch (error) {
    return apiResponse(res, {
      statusCode: 500,
      message: 'Error deleting notification',
      error: error.message
    });
  }
};

export const deleteAllNotifications = async (req, res) => {
  try {
    await Notification.deleteMany({ userId: req.user._id });

    return apiResponse(res, {
      statusCode: 200,
      message: 'All notifications deleted successfully'
    });
  } catch (error) {
    return apiResponse(res, {
      statusCode: 500,
      message: 'Error deleting notifications',
      error: error.message
    });
  }
};

export const getNotificationSettings = async (req, res) => {
  try {
    // This would typically come from a user settings model
    // For now, returning default settings
    const settings = {
      pushNotifications: true,
      emailNotifications: true,
      smsNotifications: false,
      notificationTypes: {
        new_bid: true,
        bid_accepted: true,
        bid_rejected: true,
        message_received: true,
        repair_completed: true,
        payment_received: true,
        review_received: true
      }
    };

    return apiResponse(res, {
      statusCode: 200,
      message: 'Notification settings retrieved successfully',
      data: settings
    });
  } catch (error) {
    return apiResponse(res, {
      statusCode: 500,
      message: 'Error fetching notification settings',
      error: error.message
    });
  }
};

export const updateNotificationSettings = async (req, res) => {
  try {
    const settings = req.body;
    
    // This would typically update a user settings model
    // For now, just returning the updated settings
    
    return apiResponse(res, {
      statusCode: 200,
      message: 'Notification settings updated successfully',
      data: settings
    });
  } catch (error) {
    return apiResponse(res, {
      statusCode: 500,
      message: 'Error updating notification settings',
      error: error.message
    });
  }
};

// Helper function to create notifications (used by other controllers)
export const createNotification = async (notificationData) => {
  try {
    const notification = await Notification.create(notificationData);
    return notification;
  } catch (error) {
    console.error('Error creating notification:', error);
    return null;
  }
};

export const getUnreadCount = async (req, res) => {
  try {
    const count = await Notification.countDocuments({
      userId: req.user._id,
      isRead: false
    });

    return apiResponse(res, {
      statusCode: 200,
      message: 'Unread count retrieved successfully',
      data: { unreadCount: count }
    });
  } catch (error) {
    return apiResponse(res, {
      statusCode: 500,
      message: 'Error fetching unread count',
      error: error.message
    });
  }
};

export const savePushToken = async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ message: 'Token is required' });

    await User.findByIdAndUpdate(req.user._id, {
      expoPushToken: token
    });

    res.status(200).json({ message: 'Push token saved successfully' });
  } catch (error) {
    console.error('Save token error:', error);
    res.status(500).json({ message: 'Failed to save token' });
  }
};
