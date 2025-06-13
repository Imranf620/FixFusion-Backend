import mongoose from "mongoose";

  const disputeSchema = new mongoose.Schema({
    repairRequestId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'RepairRequest',
      required: true
    },
    raisedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    againstUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    type: {
      type: String,
      enum: ['payment_issue', 'quality_issue', 'communication_issue', 'fraud_claim', 'other'],
      required: true
    },
    description: {
      type: String,
      required: [true, 'Dispute description is required'],
      maxlength: [1000, 'Description cannot exceed 1000 characters']
    },
    evidence: [{
      type: {
        type: String,
        enum: ['image', 'document', 'screenshot']
      },
      url: String,
      description: String
    }],
    status: {
      type: String,
      enum: ['open', 'investigating', 'resolved', 'closed'],
      default: 'open'
    },
    assignedAdmin: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    resolution: {
      description: String,
      resolvedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      resolvedAt: Date,
      compensationAmount: Number
    },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high', 'urgent'],
      default: 'medium'
    }
  }, {
    timestamps: true
  });
  
  
  const Dispute = mongoose.model('Dispute', disputeSchema);
  
  export default Dispute