// backend/utils/keyAuthentication.js
const crypto = require('crypto');
const mongoose = require('mongoose');
const Student = require('../models/Student');

// 定义公钥模型
const KeyPairSchema = new mongoose.Schema({
  student: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Student',
    required: true
  },
  studentId: {
    type: String,
    required: true,
    index: true
  },
  publicKey: {
    type: String,
    required: true
  },
  name: String,
  createdAt: {
    type: Date,
    default: Date.now
  },
  lastUsed: Date,
  revoked: {
    isRevoked: {
      type: Boolean,
      default: false
    },
    revokedAt: Date,
    revokedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    reason: String
  }
});

const KeyPair = mongoose.model('KeyPair', KeyPairSchema);

/**
 * 生成挑战码
 * @param {string} studentId - 学生ID
 * @returns {Promise<{challenge: string, expiresAt: Date}>} - 挑战码和过期时间
 */
const generateChallenge = async (studentId) => {
  try {
    // 查找学生
    const student = await Student.findOne({ studentId });
    if (!student) {
      throw new Error('学生不存在');
    }
    
    // 生成随机挑战码
    const challenge = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5分钟有效期
    
    // 保存挑战码
    student.authChallenge = { challenge, expiresAt };
    await student.save();
    
    return { challenge, expiresAt };
  } catch (error) {
    console.error('生成挑战码失败:', error);
    throw error;
  }
};

/**
 * 注册公钥
 * @param {string} studentId - 学生ID
 * @param {string} publicKey - 学生的公钥
 * @param {string} name - 设备名称（可选）
 * @returns {Promise<Object>} - 注册结果
 */
const registerPublicKey = async (studentId, publicKey, name = 'Default Device') => {
  try {
    // 验证公钥格式
    if (!isValidPublicKey(publicKey)) {
      throw new Error('无效的公钥格式');
    }
    
    // 查找学生
    const student = await Student.findOne({ studentId });
    if (!student) {
      throw new Error('学生不存在');
    }
    
    // 检查是否已存在相同的公钥
    const existingKey = await KeyPair.findOne({ 
      studentId, 
      publicKey,
      'revoked.isRevoked': { $ne: true }
    });
    
    if (existingKey) {
      // 更新最后使用时间
      existingKey.lastUsed = new Date();
      await existingKey.save();
      return { success: true, keyId: existingKey._id, message: '公钥已存在，已更新使用时间' };
    }
    
    // 创建新公钥记录
    const keyPair = new KeyPair({
      student: student._id,
      studentId,
      publicKey,
      name,
      lastUsed: new Date()
    });
    
    await keyPair.save();
    
    // 更新学生的认证状态
    student.verificationStatus.isVerified = true;
    student.verificationStatus.lastVerified = new Date();
    await student.save();
    
    return { 
      success: true, 
      keyId: keyPair._id,
      message: '公钥注册成功'
    };
  } catch (error) {
    console.error('注册公钥失败:', error);
    return { success: false, error: error.message };
  }
};

/**
 * 验证挑战响应
 * @param {string} studentId - 学生ID
 * @param {string} challenge - 原始挑战码
 * @param {string} signature - 用私钥签名的挑战响应
 * @returns {Promise<Object>} - 验证结果
 */
const verifySignature = async (studentId, signature) => {
  try {
    // 查找学生
    const student = await Student.findOne({ studentId });
    if (!student) {
      throw new Error('学生不存在');
    }
    
    // 验证挑战码是否存在且有效
    if (!student.authChallenge || 
        !student.authChallenge.challenge || 
        new Date() > student.authChallenge.expiresAt) {
      throw new Error('挑战码不存在或已过期');
    }
    
    const challenge = student.authChallenge.challenge;
    
    // 查找该学生的所有公钥
    const keyPairs = await KeyPair.find({ 
      studentId, 
      'revoked.isRevoked': { $ne: true }
    });
    
    if (keyPairs.length === 0) {
      throw new Error('该学生没有注册公钥');
    }
    
    // 尝试每个公钥进行验证
    for (const keyPair of keyPairs) {
      try {
        const isValid = verifyWithPublicKey(challenge, signature, keyPair.publicKey);
        
        if (isValid) {
          // 验证成功，更新使用时间
          keyPair.lastUsed = new Date();
          await keyPair.save();
          
          // 清除挑战码（一次性使用）
          student.authChallenge = null;
          
          // 记录验证历史
          student.verificationStatus.isVerified = true;
          student.verificationStatus.lastVerified = new Date();
          student.verificationStatus.verificationHistory.push({
            timestamp: new Date(),
            success: true,
            ipAddress: null, // 可在API调用处填充
            notes: `使用设备 "${keyPair.name}" 认证成功`
          });
          
          await student.save();
          
          return {
            success: true,
            keyId: keyPair._id,
            keyName: keyPair.name,
            message: '签名验证成功'
          };
        }
      } catch (verifyError) {
        // 单个密钥验证失败，继续尝试下一个
        console.log(`密钥 ${keyPair._id} 验证失败:`, verifyError.message);
      }
    }
    
    // 所有公钥都验证失败
    // 记录失败历史
    student.verificationStatus.verificationHistory.push({
      timestamp: new Date(),
      success: false,
      ipAddress: null, // 可在API调用处填充
      notes: '所有密钥验证失败'
    });
    
    await student.save();
    
    throw new Error('签名验证失败');
  } catch (error) {
    console.error('验证签名失败:', error);
    return { success: false, error: error.message };
  }
};

/**
 * 吊销公钥
 * @param {string} keyId - 公钥ID
 * @param {string} reason - 吊销原因
 * @param {string} revokedBy - 执行吊销的用户ID
 * @returns {Promise<Object>} - 吊销结果
 */
const revokePublicKey = async (keyId, reason, revokedBy) => {
  try {
    const keyPair = await KeyPair.findById(keyId);
    if (!keyPair) {
      throw new Error('公钥不存在');
    }
    
    keyPair.revoked = {
      isRevoked: true,
      revokedAt: new Date(),
      revokedBy,
      reason
    };
    
    await keyPair.save();
    
    // 检查是否还有有效的密钥
    const validKeys = await KeyPair.find({
      studentId: keyPair.studentId,
      'revoked.isRevoked': { $ne: true }
    });
    
    // 如果没有有效密钥，更新学生状态为未注册
    if (validKeys.length === 0) {
      const student = await Student.findOne({ studentId: keyPair.studentId });
      if (student) {
        student.registered = false;
        student.verificationStatus.isVerified = false;
        student.needsReauthentication = true;
        await student.save();
      }
    }
    
    return { success: true, message: '公钥已吊销' };
  } catch (error) {
    console.error('吊销公钥失败:', error);
    return { success: false, error: error.message };
  }
};

/**
 * 使用公钥验证签名
 * @param {string} data - 原始数据
 * @param {string} signature - 签名
 * @param {string} publicKey - 公钥
 * @returns {boolean} - 验证结果
 */
const verifyWithPublicKey = (data, signature, publicKey) => {
  try {
    const verify = crypto.createVerify('RSA-SHA256');
    verify.update(data);
    return verify.verify(publicKey, signature, 'base64');
  } catch (error) {
    console.error('验证签名失败:', error);
    return false;
  }
};

/**
 * 验证公钥格式
 * @param {string} publicKey - 公钥
 * @returns {boolean} - 是否为有效的公钥
 */
const isValidPublicKey = (publicKey) => {
  try {
    // 尝试导入公钥，如果成功则说明格式有效
    crypto.createPublicKey(publicKey);
    return true;
  } catch (error) {
    return false;
  }
};

/**
 * 获取学生的所有公钥
 * @param {string} studentId - 学生ID
 * @returns {Promise<Array>} - 公钥列表
 */
const getStudentKeys = async (studentId) => {
  try {
    return await KeyPair.find({ studentId })
      .sort({ lastUsed: -1 })
      .select('-publicKey'); // 不返回完整公钥内容，只返回元数据
  } catch (error) {
    console.error('获取学生公钥失败:', error);
    throw error;
  }
};

module.exports = {
  KeyPair,
  generateChallenge,
  registerPublicKey,
  verifySignature,
  revokePublicKey,
  getStudentKeys
};