import mongoose from "mongoose";

const transactionSchema = new mongoose.Schema({
    repairRequestId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'RepairRequest',
      required: true
    },
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    technicianId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    amount: {
      type: Number,
      required: true,
      min: [0, 'Amount cannot be negative']
    },
    currency: {
      type: String,
      default: 'PKR'
    },
    type: {
      type: String,
      enum: ['repair_payment', 'subscription_fee', 'refund'],
    },
    status: {
      type: String,
      enum: ['pending', 'completed', 'failed', 'refunded'],
      default: 'pending'
    },
    paymentMethod: {
      type: String,
      enum: ['cash', 'jazzcash', 'easypaisa', 'bank_transfer', 'card']
    },
    transactionId: {
      type: String,
      unique: true,
      sparse: true
    },
    paymentGatewayResponse: mongoose.Schema.Types.Mixed,
    completedAt: Date,
    failureReason: String
  }, {
    timestamps: true
  });
  
  
  const Transaction = mongoose.model('Transaction', transactionSchema);

  export default Transaction
  