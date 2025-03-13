// backend/models/Student.js
const mongoose = require('mongoose');

const StudentSchema = new mongoose.Schema({
  studentId: {
    type: String,
    required: true,
    unique: true,
    trim: true
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
  }]
}, { timestamps: true });

module.exports = mongoose.model('Student', StudentSchema);