// backend/utils/backup.js
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const { MongoClient } = require('mongodb');
require('dotenv').config();

// Models
const Student = require('../models/Student');
const User = require('../models/User');

/**
 * Create a backup of the database
 */
async function createBackup() {
  console.log('开始数据库备份...');
  
  try {
    // 创建备份目录
    const backupDir = path.join(__dirname, '../backups');
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }
    
    // 生成备份文件名 (使用时间戳)
    const timestamp = new Date().toISOString().replace(/:/g, '-');
    const backupFile = path.join(backupDir, `backup-${timestamp}.json`);
    
    // 获取数据
    const students = await Student.find().lean();
    const users = await User.find().lean();
    
    // 创建备份数据
    const backupData = {
      timestamp,
      students,
      users,
      metadata: {
        version: '1.0',
        studentCount: students.length,
        userCount: users.length
      }
    };
    
    // 写入文件
    fs.writeFileSync(backupFile, JSON.stringify(backupData, null, 2));
    console.log(`数据库备份成功: ${backupFile}`);
    
    // 如果配置了MongoDB Atlas备份，则同时备份到Atlas
    if (process.env.MONGO_ATLAS_URI) {
      await backupToAtlas(backupData);
    }
    
    // 清理旧备份 (保留最新10个)
    cleanupOldBackups(backupDir);
    
    return { success: true, file: backupFile };
  } catch (error) {
    console.error('备份失败:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Backup to MongoDB Atlas
 */
async function backupToAtlas(backupData) {
  try {
    console.log('开始备份到MongoDB Atlas...');
    
    const client = new MongoClient(process.env.MONGO_ATLAS_URI);
    await client.connect();
    
    const db = client.db(process.env.MONGO_ATLAS_DB || 'course_monitor_backup');
    const backupCollection = db.collection('backups');
    
    // 添加备份记录
    await backupCollection.insertOne({
      ...backupData,
      createdAt: new Date()
    });
    
    console.log('MongoDB Atlas备份成功');
    await client.close();
    return true;
  } catch (error) {
    console.error('MongoDB Atlas备份失败:', error);
    return false;
  }
}

/**
 * Clean up old backups, keeping only the most recent ones
 */
function cleanupOldBackups(backupDir, keepCount = 10) {
  try {
    // 获取目录中的所有备份文件
    const files = fs.readdirSync(backupDir)
      .filter(file => file.startsWith('backup-') && file.endsWith('.json'))
      .map(file => ({
        name: file,
        path: path.join(backupDir, file),
        time: fs.statSync(path.join(backupDir, file)).mtime.getTime()
      }))
      .sort((a, b) => b.time - a.time); // 按修改时间降序排列
    
    // 删除旧备份
    if (files.length > keepCount) {
      console.log(`清理旧备份，保留最新的 ${keepCount} 个备份`);
      
      files.slice(keepCount).forEach(file => {
        fs.unlinkSync(file.path);
        console.log(`已删除旧备份: ${file.name}`);
      });
    }
  } catch (error) {
    console.error('清理旧备份失败:', error);
  }
}

/**
 * Restore from a backup file
 */
async function restoreFromBackup(backupFilePath) {
  try {
    console.log(`开始从备份恢复: ${backupFilePath}`);
    
    // 读取备份文件
    const backupData = JSON.parse(fs.readFileSync(backupFilePath, 'utf8'));
    
    // 清空现有集合
    await Student.deleteMany({});
    await User.deleteMany({});
    
    // 恢复学生数据
    if (backupData.students && backupData.students.length > 0) {
      await Student.insertMany(backupData.students);
      console.log(`已恢复 ${backupData.students.length} 名学生数据`);
    }
    
    // 恢复用户数据
    if (backupData.users && backupData.users.length > 0) {
      await User.insertMany(backupData.users);
      console.log(`已恢复 ${backupData.users.length} 名用户数据`);
    }
    
    console.log('数据恢复成功');
    return { success: true };
  } catch (error) {
    console.error('从备份恢复失败:', error);
    return { success: false, error: error.message };
  }
}

module.exports = {
  createBackup,
  restoreFromBackup,
  backupToAtlas
};