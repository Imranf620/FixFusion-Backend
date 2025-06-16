import Transaction from '../models/transactionSchema.js';
import RepairRequest from '../models/repairRequestSchema.js';
import User from '../models/userSchema.js';
import { apiResponse } from '../utils/apiResponse.js';

// Get all transactions for the logged-in user
export const getAllTransactions = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const parsedPage = parseInt(page);
    const parsedLimit = parseInt(limit);
    const skip = (parsedPage - 1) * parsedLimit;

    // Find transactions where user is either customer or technician
    const filter = {
      $or: [
        { customerId: req.user._id },
        { technicianId: req.user._id }
      ]
    };

    const transactions = await Transaction.find(filter)
      .populate('customerId', 'name email phone')
      .populate('technicianId', 'name email phone')
      .populate('repairRequestId', 'title description status')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parsedLimit);

    const total = await Transaction.countDocuments(filter);

    return apiResponse(res, {
      statusCode: 200,
      message: 'Transactions retrieved successfully',
      data: {
        transactions,
        pagination: {
          page: parsedPage,
          limit: parsedLimit,
          total,
          pages: Math.ceil(total / parsedLimit)
        }
      }
    });
  } catch (error) {
    console.error('Get All Transactions Error:', error);
    return apiResponse(res, {
      statusCode: 500,
      message: 'Error fetching transactions',
      error: error.message
    });
  }
};

// Get single transaction by ID
export const getTransactionById = async (req, res) => {
  try {
    const { transactionId } = req.params;

    const transaction = await Transaction.findById(transactionId)
      .populate('customerId', 'name email phone')
      .populate('technicianId', 'name email phone')
      .populate('repairRequestId', 'title description status');

    if (!transaction) {
      return apiResponse(res, {
        statusCode: 404,
        message: 'Transaction not found'
      });
    }

    // Check if user is authorized to view this transaction
    const isAuthorized = 
      transaction.customerId._id.toString() === req.user._id.toString() || 
      transaction.technicianId._id.toString() === req.user._id.toString();

    if (!isAuthorized) {
      return apiResponse(res, {
        statusCode: 403,
        message: 'Not authorized to view this transaction'
      });
    }

    return apiResponse(res, {
      statusCode: 200,
      message: 'Transaction retrieved successfully',
      data: transaction
    });
  } catch (error) {
    console.error('Get Transaction Error:', error);
    return apiResponse(res, {
      statusCode: 500,
      message: 'Error fetching transaction',
      error: error.message
    });
  }
};

// Create payment when repair is completed
export const createPayment = async (req, res) => {
  try {
    const { repairRequestId, amount, paymentMethod } = req.body;

    // Find the repair request
    const repairRequest = await RepairRequest.findById(repairRequestId)
      .populate('customerId', 'name email')
      .populate('assignedTechnician', 'name email');

    if (!repairRequest) {
      return apiResponse(res, {
        statusCode: 404,
        message: 'Repair request not found'
      });
    }

    // Check if repair is completed
    if (repairRequest.status !== 'completed') {
      return apiResponse(res, {
        statusCode: 400,
        message: 'Payment can only be made for completed repairs'
      });
    }

    // Check if user is the customer of this repair request
    if (repairRequest.customerId._id.toString() !== req.user._id.toString()) {
      return apiResponse(res, {
        statusCode: 403,
        message: 'Only the customer can make payment for this repair'
      });
    }

    // Check if payment already exists
    const existingTransaction = await Transaction.findOne({ repairRequestId });
    if (existingTransaction) {
      return apiResponse(res, {
        statusCode: 400,
        message: 'Payment already exists for this repair request'
      });
    }

    // Create the transaction
    const transaction = await Transaction.create({
      repairRequestId,
      customerId: repairRequest.customerId._id,
      technicianId: repairRequest.assignedTechnician._id,
      amount,
      paymentMethod,
      status: 'completed',
      completedAt: new Date()
    });

    // Populate the created transaction
    await transaction.populate([
      { path: 'customerId', select: 'name email phone' },
      { path: 'technicianId', select: 'name email phone' },
      { path: 'repairRequestId', select: 'title description status' }
    ]);

    // Update repair request status to paid
    await RepairRequest.findByIdAndUpdate(repairRequestId, {
      status: 'paid',
      updatedAt: new Date()
    });

    return apiResponse(res, {
      statusCode: 201,
      message: 'Payment completed successfully',
      data: transaction
    });
  } catch (error) {
    console.error('Create Payment Error:', error);
    return apiResponse(res, {
      statusCode: 500,
      message: 'Error processing payment',
      error: error.message
    });
  }
};