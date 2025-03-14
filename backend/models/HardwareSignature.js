// backend/models/HardwareSignature.js
const mongoose = require('mongoose');

const HardwareSignatureSchema = new mongoose.Schema({
  student: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Student',
    required: true
  },
  signature: {
    // 硬件信息
    cpuModel: String,
    cpuCores: Number,
    cpuSpeed: Number,
    totalMemory: Number,
    platform: String,
    hostname: String,
    username: String,
    networkInterfaces: Array,
    displayResolution: String,
    timezone: String,
    diskLayout: Array,
    // 其他可能的硬件标识符
    macAddresses: [String],
    deviceId: String,
    biosSerial: String,
    // 可选的浏览器指纹
    userAgent: String,
    plugins: Array,
    fonts: Array,
    canvas: String
  },
  ipAddress: String,
  timestamp: {
    type: Date,
    default: Date.now
  },
  suspicious: {
    type: Boolean,
    default: false
  },
  notes: String
}, { timestamps: true });

// 创建针对student字段和timestamp的复合索引
HardwareSignatureSchema.index({ student: 1, timestamp: -1 });

// 添加方法：匹配硬件签名
HardwareSignatureSchema.statics.matchSignature = async function(studentId, signature) {
  try {
    // 获取学生最近的签名记录
    const recentSignatures = await this.find({ student: studentId })
      .sort({ timestamp: -1 })
      .limit(5);
    
    if (recentSignatures.length === 0) {
      // 没有历史记录，这是第一次
      return { match: true, confidence: 1, reason: '首次签名' };
    }
    
    // 计算签名匹配分数
    const scores = recentSignatures.map(record => {
      let matchPoints = 0;
      let totalPoints = 0;
      
      // 检查关键硬件特征
      // CPU模型（高权重）
      if (record.signature.cpuModel && signature.cpuModel) {
        totalPoints += 3;
        matchPoints += (record.signature.cpuModel === signature.cpuModel) ? 3 : 0;
      }
      
      // CPU核心数
      if (record.signature.cpuCores && signature.cpuCores) {
        totalPoints += 1;
        matchPoints += (record.signature.cpuCores === signature.cpuCores) ? 1 : 0;
      }
      
      // 内存大小（允许小变化）
      if (record.signature.totalMemory && signature.totalMemory) {
        totalPoints += 2;
        const memoryDiff = Math.abs(record.signature.totalMemory - signature.totalMemory);
        const memoryThreshold = record.signature.totalMemory * 0.05; // 允许5%的差异
        matchPoints += (memoryDiff <= memoryThreshold) ? 2 : 0;
      }
      
      // 主机名
      if (record.signature.hostname && signature.hostname) {
        totalPoints += 2;
        matchPoints += (record.signature.hostname === signature.hostname) ? 2 : 0;
      }
      
      // 用户名
      if (record.signature.username && signature.username) {
        totalPoints += 2;
        matchPoints += (record.signature.username === signature.username) ? 2 : 0;
      }
      
      // MAC地址（高权重）
      if (record.signature.macAddresses && signature.macAddresses) {
        totalPoints += 4;
        // 检查至少有一个MAC地址匹配
        const hasMatchingMac = record.signature.macAddresses.some(mac => 
          signature.macAddresses.includes(mac));
        matchPoints += hasMatchingMac ? 4 : 0;
      }
      
      // BIOS序列号（如果有，高权重）
      if (record.signature.biosSerial && signature.biosSerial) {
        totalPoints += 5;
        matchPoints += (record.signature.biosSerial === signature.biosSerial) ? 5 : 0;
      }
      
      // 平台
      if (record.signature.platform && signature.platform) {
        totalPoints += 1;
        matchPoints += (record.signature.platform === signature.platform) ? 1 : 0;
      }
      
      // 显示分辨率
      if (record.signature.displayResolution && signature.displayResolution) {
        totalPoints += 1;
        matchPoints += (record.signature.displayResolution === signature.displayResolution) ? 1 : 0;
      }
      
      // 计算匹配分数（0-1之间）
      return totalPoints > 0 ? (matchPoints / totalPoints) : 0;
    });
    
    // 取最高匹配分数
    const maxScore = Math.max(...scores);
    
    // 判断是否匹配（阈值可调整）
    const threshold = 0.7; // 70%匹配视为同一设备
    const match = maxScore >= threshold;
    
    return {
      match,
      confidence: maxScore,
      reason: match ? '硬件签名匹配' : '硬件签名差异过大',
      threshold
    };
  } catch (error) {
    console.error('匹配硬件签名失败:', error);
    return { match: false, error: error.message };
  }
};

module.exports = mongoose.model('HardwareSignature', HardwareSignatureSchema);