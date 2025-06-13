import mongoose from "mongoose";

const adminLogSchema = new mongoose.Schema({
    adminId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    action: {
      type: String,
      required: true,
      enum: ['user_approved', 'user_suspended', 'dispute_resolved', 'content_moderated', 
             'system_maintenance', 'data_export', 'policy_updated']
    },
    targetType: {
      type: String,
      enum: ['user', 'repair_request', 'bid', 'review', 'chat', 'system']
    },
    targetId: mongoose.Schema.Types.ObjectId,
    description: {
      type: String,
      required: true,
      maxlength: [500, 'Description cannot exceed 500 characters']
    },
    metadata: mongoose.Schema.Types.Mixed,
    ipAddress: String,
    userAgent: String
  }, {
    timestamps: true
  });
  
 
  const AdminLog = mongoose.model('AdminLog', adminLogSchema);
  export default AdminLog
