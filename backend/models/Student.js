// backend/models/Student.js - 添加挑战码和硬件签名相关字段
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const StudentSchema = new mongoose.Schema({
  studentId: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  password: {
    type: String,
    required: true,
    default: function() {
      // Default to student ID as password for initial setup
      return this.studentId;
    }
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  ipAddress: {
    type: String,
    required: true
  },
  port: {
    type: Number,
    default: 3000
  },
  status: {
    type: String,
    enum: ['online', 'offline', 'unknown'],
    default: 'unknown'
  },
  lastReportTime: {
    type: Date,
    default: Date.now
  },
  todoCount: {
    type: Number,
    default: 0
  },
  apiVersion: String,
  lastTestResults: {
    score: Number,           // 总得分
    maxPossibleScore: Number, // 满分值
    totalPassed: Number,
    totalFailed: Number,
    timestamp: Date,
    tests: [{
      name: String,          // 测试名称
      endpoint: String,      // API端点
      method: String,        // HTTP方法
      passed: Boolean,       // 自动判断的通过状态
      response: Object,      // API响应内容
      error: String,         // 错误信息
      score: {               // 手动评分信息
        value: {
          type: Number,
          default: 0
        },
        maxValue: {
          type: Number,
          default: 10
        },
        gradedBy: mongoose.Schema.Types.ObjectId,
        gradedAt: Date,
        comments: String
      }
    }]
  },
  todos: [{
    id: Number,
    title: String,
    completed: Boolean,
    created_at: Date
  }],
  pendingCommand: {
    command: String,
    params: Object,
    issuedAt: Date
  },
  registered: {
    type: Boolean,
    default: false
  },
  // 新增：挑战-响应认证相关字段
  authChallenge: {
    challenge: String,
    expiresAt: Date
  },
  verificationStatus: {
    isVerified: {
      type: Boolean,
      default: false
    },
    lastVerified: Date,
    verificationHistory: [{
      timestamp: Date,
      success: Boolean,
      ipAddress: String,
      hardwareSignatureId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'HardwareSignature'
      },
      notes: String
    }]
  },
  // 可疑行为标记
  suspiciousActivity: {
    isFlagged: {
      type: Boolean,
      default: false
    },
    reason: String,
    flaggedAt: Date,
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    reviewNotes: String
  }
}, { timestamps: true });

// Password hash middleware
StudentSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Verify password method
StudentSchema.methods.matchPassword = async function(enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// 新增：记录验证历史
StudentSchema.methods.recordVerification = async function(success, ipAddress, hardwareSignatureId, notes) {
  this.verificationStatus.verificationHistory.push({
    timestamp: new Date(),
    success,
    ipAddress,
    hardwareSignatureId,
    notes
  });
  
  if (success) {
    this.verificationStatus.isVerified = true;
    this.verificationStatus.lastVerified = new Date();
  }
  
  return this.save();
};

// 新增：标记可疑活动
StudentSchema.methods.flagAsSuspicious = async function(reason) {
  this.suspiciousActivity = {
    isFlagged: true,
    reason,
    flaggedAt: new Date()
  };
  
  return this.save();
};

module.exports = mongoose.model('Student', StudentSchema);