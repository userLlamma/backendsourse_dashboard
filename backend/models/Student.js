// backend/models/Student.js
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
    score: Number,
    totalPassed: Number,
    totalFailed: Number,
    timestamp: Date,
    tests: [{
      name: String,
      passed: Boolean,
      error: String
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

module.exports = mongoose.model('Student', StudentSchema);