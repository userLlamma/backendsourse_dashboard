// backend/utils/APIScoreModel.js
const fs = require('fs');
const path = require('path');
const { RandomForestRegression } = require('ml-random-forest');
const Matrix = require('ml-matrix');

/**
 * API响应评分模型
 * 使用轻量级机器学习模型进行增量学习的API响应评分系统
 */
class APIScoreModel {
  constructor(options = {}) {
    this.options = {
      dataDir: path.join(__dirname, '../data'),
      modelFile: 'api_score_model.json',
      trainingDataFile: 'training_data.json',
      featureExtractors: {},
      minSamples: 3,  // 开始训练的最小样本数
      cloudScoreWeight: 0.6,  // 云API评分的初始权重
      ruleScoreWeight: 0.3,   // 规则评分的初始权重
      modelScoreWeight: 0.1,   // 模型评分的初始权重
      ...options
    };

    // 确保数据目录存在
    if (!fs.existsSync(this.options.dataDir)) {
      fs.mkdirSync(this.options.dataDir, { recursive: true });
    }

    this.modelPath = path.join(this.options.dataDir, this.options.modelFile);
    this.trainingDataPath = path.join(this.options.dataDir, this.options.trainingDataFile);
    
    // 初始化训练数据
    this.trainingData = this.loadTrainingData();
    
    // 初始化模型
    this.model = this.loadModel();
    
    // 配置默认特征提取器
    this.configureFeatureExtractors();
    
    // 模型指标
    this.metrics = {
      sampleCount: this.trainingData.length,
      lastTrainingTime: null,
      trainingSamples: 0,
      averageError: 0,
      confidenceScore: 0,
      scoreDistribution: {}
    };
    
    // 更新权重
    this.updateWeights();
  }

  /**
   * 配置默认特征提取器
   */
  configureFeatureExtractors() {
    // 设置默认特征提取器
    const defaultExtractors = {
      // 结构相似度 - 检查API响应的结构是否匹配
      structureSimilarity: (studentResponse, referenceResponse) => {
        try {
          // 提取两个响应中的所有键（扁平化）
          const studentKeys = this.flattenKeys(studentResponse);
          const referenceKeys = this.flattenKeys(referenceResponse);
          
          // 计算键重合率
          const commonKeys = studentKeys.filter(key => referenceKeys.includes(key));
          const keySimilarity = commonKeys.length / referenceKeys.length;
          
          // 给一个较高权重: 0-1之间的相似度分数
          return keySimilarity;
        } catch (err) {
          console.error('结构相似度特征提取失败:', err);
          return 0;
        }
      },
      
      // 数据类型匹配 - 检查每个字段的数据类型是否正确
      typeMatch: (studentResponse, referenceResponse) => {
        try {
          const studentTypes = this.extractTypes(studentResponse);
          const referenceTypes = this.extractTypes(referenceResponse);
          
          // 计算类型匹配分数
          let matchCount = 0;
          let totalFields = 0;
          
          for (const key in referenceTypes) {
            if (studentTypes.hasOwnProperty(key)) {
              totalFields++;
              if (referenceTypes[key] === studentTypes[key]) {
                matchCount++;
              }
            }
          }
          
          return totalFields > 0 ? matchCount / totalFields : 0;
        } catch (err) {
          console.error('类型匹配特征提取失败:', err);
          return 0;
        }
      },
      
      // 值相似度 - 对于键存在的情况，检查值的相似度
      valueSimilarity: (studentResponse, referenceResponse) => {
        try {
          // 扁平化对象
          const studentFlat = this.flattenObject(studentResponse);
          const referenceFlat = this.flattenObject(referenceResponse);
          
          let similarityScore = 0;
          let totalFields = 0;
          
          // 对于参考响应中的每个字段
          for (const key in referenceFlat) {
            if (studentFlat.hasOwnProperty(key)) {
              totalFields++;
              
              const refValue = referenceFlat[key];
              const studentValue = studentFlat[key];
              
              // 根据类型计算相似度
              if (typeof refValue === 'number' && typeof studentValue === 'number') {
                // 数值相似度 (归一化)
                const maxVal = Math.max(Math.abs(refValue), Math.abs(studentValue));
                const normalizedDiff = maxVal === 0 ? 1 : 1 - Math.abs(refValue - studentValue) / maxVal;
                similarityScore += normalizedDiff > 0 ? normalizedDiff : 0;
              } else if (typeof refValue === 'string' && typeof studentValue === 'string') {
                // 字符串相似度 (简单的相等检查)
                similarityScore += refValue === studentValue ? 1 : 0;
              } else if (typeof refValue === 'boolean' && typeof studentValue === 'boolean') {
                // 布尔值相等检查
                similarityScore += refValue === studentValue ? 1 : 0;
              } else {
                // 其他类型，简单检查是否相等
                similarityScore += JSON.stringify(refValue) === JSON.stringify(studentValue) ? 1 : 0;
              }
            }
          }
          
          return totalFields > 0 ? similarityScore / totalFields : 0;
        } catch (err) {
          console.error('值相似度特征提取失败:', err);
          return 0;
        }
      },
      
      // 完整性 - 检查学生响应是否包含所有必要字段
      completeness: (studentResponse, referenceResponse) => {
        try {
          const studentKeys = this.flattenKeys(studentResponse);
          const referenceKeys = this.flattenKeys(referenceResponse);
          
          // 计算学生响应包含的必要字段比例
          const requiredKeys = new Set(referenceKeys);
          const matchedRequiredKeys = studentKeys.filter(key => requiredKeys.has(key));
          
          return requiredKeys.size > 0 ? matchedRequiredKeys.length / requiredKeys.size : 0;
        } catch (err) {
          console.error('完整性特征提取失败:', err);
          return 0;
        }
      },
      
      // 数组长度匹配 - 检查数组类型字段的长度是否接近
      arrayLengthMatch: (studentResponse, referenceResponse) => {
        try {
          const studentArrays = this.findArrays(studentResponse);
          const referenceArrays = this.findArrays(referenceResponse);
          
          let totalScore = 0;
          let totalArrays = 0;
          
          // 对参考答案中的每个数组
          for (const [path, refArray] of Object.entries(referenceArrays)) {
            if (studentArrays.hasOwnProperty(path) && Array.isArray(studentArrays[path])) {
              totalArrays++;
              const studentArray = studentArrays[path];
              
              // 计算长度匹配分数 (0-1)
              const lengthDiff = Math.abs(refArray.length - studentArray.length);
              const maxLength = Math.max(refArray.length, 1);  // 避免除以0
              const lengthMatchScore = Math.max(0, 1 - (lengthDiff / maxLength));
              
              totalScore += lengthMatchScore;
            }
          }
          
          return totalArrays > 0 ? totalScore / totalArrays : 0;
        } catch (err) {
          console.error('数组长度匹配特征提取失败:', err);
          return 0;
        }
      },
      
      // 额外字段 - 学生响应是否包含参考答案中不存在的字段
      extraFields: (studentResponse, referenceResponse) => {
        try {
          const studentKeys = this.flattenKeys(studentResponse);
          const referenceKeys = this.flattenKeys(referenceResponse);
          
          const extraKeys = studentKeys.filter(key => !referenceKeys.includes(key));
          
          // 计算额外字段比例 (反向指标)
          // 如果没有额外字段，分数为1；如果额外字段过多，则接近0
          return studentKeys.length > 0 ? 
            Math.max(0, 1 - (extraKeys.length / studentKeys.length)) : 0;
        } catch (err) {
          console.error('额外字段特征提取失败:', err);
          return 0;
        }
      },
      
      // HTTP状态码匹配
      statusCodeMatch: (studentResponse, referenceResponse, testCase) => {
        // 检查是否有状态码信息
        if (!testCase || !testCase.expectedStatus) return 1;
        
        return testCase.status === testCase.expectedStatus ? 1 : 0;
      }
    };
    
    // 合并用户提供的特征提取器和默认提取器
    this.featureExtractors = { ...defaultExtractors, ...this.options.featureExtractors };
  }

  /**
   * 提取特征向量
   * @param {Object} studentResponse - 学生的API响应
   * @param {Object} referenceResponse - 参考API响应
   * @param {Object} testCase - 测试用例信息
   * @returns {Array} 特征向量
   */
  extractFeatures(studentResponse, referenceResponse, testCase = {}) {
    const features = [];
    
    // 应用每个特征提取器并收集结果
    for (const [name, extractor] of Object.entries(this.featureExtractors)) {
      try {
        const featureValue = extractor(studentResponse, referenceResponse, testCase);
        features.push(featureValue);
      } catch (err) {
        console.error(`特征提取器 ${name} 失败:`, err);
        features.push(0);  // 失败时使用默认值
      }
    }
    
    return features;
  }

  /**
   * 提供API响应评分
   * @param {Object} studentResponse - 学生的API响应
   * @param {Object} referenceResponse - 参考API响应
   * @param {Object} testCase - 测试用例信息
   * @param {Object} options - 评分选项
   * @returns {Object} 评分结果
   */
  scoreResponse(studentResponse, referenceResponse, testCase = {}, options = {}) {
    // 提取特征
    const features = this.extractFeatures(studentResponse, referenceResponse, testCase);
    
    // 三种评分策略
    const ruleScore = this.getRuleBasedScore(features);
    let modelScore = 0;
    let confidence = 0;
    
    // 如果有足够样本，使用模型评分
    if (this.trainingData.length >= this.options.minSamples && this.model) {
      try {
        const prediction = this.model.predict([features]);
        modelScore = prediction[0];
        
        // 计算置信度 - 基于样本数量和特征值分布
        confidence = Math.min(0.9, 0.3 + (this.trainingData.length / 50) * 0.6);
      } catch (err) {
        console.error('模型预测失败:', err);
        modelScore = ruleScore;  // 失败时使用规则分数
        confidence = 0.1;
      }
    }
    
    // 云API评分 (如果提供)
    const cloudScore = options.cloudScore || null;
    
    // 组合最终分数
    const { finalScore, weights } = this.combineScores(ruleScore, modelScore, cloudScore);
    
    // 准备响应
    return {
      score: Math.round(finalScore * 10) / 10,  // 保留一位小数
      confidence,
      featureValues: features,
      details: {
        ruleScore,
        modelScore,
        cloudScore,
        weights,
        featureNames: Object.keys(this.featureExtractors)
      }
    };
  }

  /**
   * 组合不同评分策略的结果
   * @param {number} ruleScore - 基于规则的评分
   * @param {number} modelScore - 模型评分
   * @param {number|null} cloudScore - 云API评分
   * @returns {Object} 组合后的分数和权重
   */
  combineScores(ruleScore, modelScore, cloudScore) {
    // 根据当前样本数量动态调整权重
    this.updateWeights();
    
    let { cloudScoreWeight, ruleScoreWeight, modelScoreWeight } = this;
    
    // 如果没有云评分，重新分配权重
    if (cloudScore === null) {
      const totalRemainingWeight = ruleScoreWeight + modelScoreWeight;
      ruleScoreWeight = totalRemainingWeight > 0 ? 
        ruleScoreWeight / totalRemainingWeight : 0.5;
      modelScoreWeight = totalRemainingWeight > 0 ? 
        modelScoreWeight / totalRemainingWeight : 0.5;
      cloudScoreWeight = 0;
    }
    
    // 计算最终分数
    let finalScore = 0;
    finalScore += ruleScore * ruleScoreWeight;
    finalScore += modelScore * modelScoreWeight;
    if (cloudScore !== null) {
      finalScore += cloudScore * cloudScoreWeight;
    }
    
    // 确保分数在合理范围内
    finalScore = Math.max(0, Math.min(10, finalScore));
    
    return {
      finalScore,
      weights: {
        rule: ruleScoreWeight,
        model: modelScoreWeight,
        cloud: cloudScoreWeight
      }
    };
  }

  /**
   * 更新各评分策略的权重
   */
  updateWeights() {
    const sampleCount = this.trainingData.length;
    
    // 模型权重随样本数增加而增加
    if (sampleCount < this.options.minSamples) {
      this.modelScoreWeight = 0.1;
    } else if (sampleCount < 10) {
      this.modelScoreWeight = 0.3;
    } else if (sampleCount < 20) {
      this.modelScoreWeight = 0.5;
    } else if (sampleCount < 50) {
      this.modelScoreWeight = 0.7;
    } else {
      this.modelScoreWeight = 0.8;
    }
    
    // 云API权重随样本数增加而减少
    if (sampleCount < this.options.minSamples) {
      this.cloudScoreWeight = 0.6;
    } else if (sampleCount < 10) {
      this.cloudScoreWeight = 0.5;
    } else if (sampleCount < 20) {
      this.cloudScoreWeight = 0.3;
    } else if (sampleCount < 50) {
      this.cloudScoreWeight = 0.2;
    } else {
      this.cloudScoreWeight = 0.1;
    }
    
    // 规则评分权重作为补充
    this.ruleScoreWeight = 1 - this.modelScoreWeight - this.cloudScoreWeight;
    
    // 确保权重总和为1
    const totalWeight = this.modelScoreWeight + this.cloudScoreWeight + this.ruleScoreWeight;
    if (Math.abs(totalWeight - 1) > 0.001) {
      this.modelScoreWeight /= totalWeight;
      this.cloudScoreWeight /= totalWeight;
      this.ruleScoreWeight /= totalWeight;
    }
  }

  /**
   * 获取基于规则的评分
   * @param {Array} features - 特征向量
   * @returns {number} 规则评分
   */
  getRuleBasedScore(features) {
    // 简单加权平均
    const weights = [
      0.25,  // 结构相似度
      0.15,  // 类型匹配
      0.25,  // 值相似度
      0.15,  // 完整性
      0.10,  // 数组长度匹配
      0.05,  // 额外字段
      0.05   // HTTP状态码匹配
    ];

    // 确保权重数组与特征数匹配
    const adjustedWeights = weights.slice(0, features.length);
    if (adjustedWeights.length < features.length) {
      const remainingWeight = (1 - adjustedWeights.reduce((a, b) => a + b, 0)) / (features.length - adjustedWeights.length);
      for (let i = adjustedWeights.length; i < features.length; i++) {
        adjustedWeights.push(remainingWeight);
      }
    }
    
    // 计算加权平均
    let score = 0;
    for (let i = 0; i < features.length; i++) {
      score += features[i] * adjustedWeights[i];
    }
    
    // 将分数转换为0-10范围
    return score * 10;
  }

  /**
   * 添加训练样本并增量学习
   * @param {Object} studentResponse - 学生的API响应
   * @param {Object} referenceResponse - 参考API响应
   * @param {number} teacherScore - 教师评分 (0-10)
   * @param {Object} testCase - 测试用例信息
   * @returns {Object} 学习结果
   */
  learn(studentResponse, referenceResponse, teacherScore, testCase = {}) {
    // 提取特征
    const features = this.extractFeatures(studentResponse, referenceResponse, testCase);
    
    // 创建训练样本
    const sample = {
      features,
      teacherScore,
      timestamp: new Date().toISOString(),
      testCaseInfo: {
        endpoint: testCase.endpoint || '',
        method: testCase.method || '',
        name: testCase.name || ''
      }
    };
    
    // 自动评分 (用于比较)
    const autoScore = this.scoreResponse(studentResponse, referenceResponse, testCase).score;
    
    // 计算评分差异
    const scoreDiff = Math.abs(teacherScore - autoScore);
    
    // 只有当评分差异足够大时才添加到训练集
    // 这可以避免过多相似的样本
    const diffThreshold = 0.5;  // 分差阈值
    let added = false;
    
    if (scoreDiff >= diffThreshold || this.trainingData.length < this.options.minSamples) {
      this.trainingData.push(sample);
      added = true;
      
      // 保存训练数据
      this.saveTrainingData();
      
      // 如果有足够的样本，训练模型
      if (this.trainingData.length >= this.options.minSamples) {
        this.trainModel();
      }
    }
    
    return {
      added,
      scoreDiff,
      currentSamples: this.trainingData.length,
      sufficientData: this.trainingData.length >= this.options.minSamples,
      autoScore
    };
  }

  /**
   * 训练回归模型
   * @returns {boolean} 训练是否成功
   */
  trainModel() {
    if (this.trainingData.length < this.options.minSamples) {
      console.log('训练样本不足，需要至少', this.options.minSamples, '个样本');
      return false;
    }
    
    try {
      const startTime = Date.now();
      
      // 准备训练数据
      const X = new Matrix(this.trainingData.map(sample => sample.features));
      const y = Matrix.columnVector(this.trainingData.map(sample => sample.teacherScore));
      
      // 创建并训练随机森林回归模型
      const options = {
        nEstimators: 10,  // 树的数量
        maxDepth: 4,      // 最大深度
        treeOptions: {
          minNumSamples: 2  // 节点分裂所需的最小样本数
        }
      };
      
      this.model = new RandomForestRegression(options);
      this.model.train(X, y);
      
      // 计算训练时间
      const trainingTime = Date.now() - startTime;
      
      // 评估模型
      const predictions = this.model.predict(X);
      const errors = Array.from(predictions).map((pred, i) => Math.abs(pred - this.trainingData[i].teacherScore));
      const avgError = errors.reduce((a, b) => a + b, 0) / errors.length;
      
      // 更新指标
      this.metrics.lastTrainingTime = new Date().toISOString();
      this.metrics.trainingSamples = this.trainingData.length;
      this.metrics.averageError = avgError;
      this.metrics.confidenceScore = Math.max(0.3, 1 - avgError / 10);
      this.metrics.trainingTimeMs = trainingTime;
      
      // 更新分数分布
      const scoreCountMap = {};
      this.trainingData.forEach(sample => {
        const scoreInt = Math.floor(sample.teacherScore);
        scoreCountMap[scoreInt] = (scoreCountMap[scoreInt] || 0) + 1;
      });
      this.metrics.scoreDistribution = scoreCountMap;
      
      // 保存模型
      this.saveModel();
      
      console.log(`模型训练完成 (${trainingTime}ms)，平均误差: ${avgError.toFixed(2)}`);
      return true;
    } catch (err) {
      console.error('模型训练失败:', err);
      return false;
    }
  }

  /**
   * 保存训练数据到文件
   * @returns {boolean} 保存是否成功
   */
  saveTrainingData() {
    try {
      fs.writeFileSync(
        this.trainingDataPath,
        JSON.stringify({
          samples: this.trainingData,
          metrics: this.metrics,
          updated: new Date().toISOString()
        }, null, 2)
      );
      return true;
    } catch (err) {
      console.error('保存训练数据失败:', err);
      return false;
    }
  }

  /**
   * 加载训练数据
   * @returns {Array} 训练数据
   */
  loadTrainingData() {
    try {
      if (fs.existsSync(this.trainingDataPath)) {
        const data = JSON.parse(fs.readFileSync(this.trainingDataPath, 'utf8'));
        if (data.metrics) {
          this.metrics = { ...this.metrics, ...data.metrics };
        }
        console.log(`已加载${data.samples.length}个训练样本`);
        return data.samples || [];
      }
    } catch (err) {
      console.error('加载训练数据失败:', err);
    }
    return [];
  }

  /**
   * 保存模型到文件
   * @returns {boolean} 保存是否成功
   */
  saveModel() {
    if (!this.model) return false;
    
    try {
      // 序列化模型
      const modelJson = JSON.stringify(this.model.toJSON());
      fs.writeFileSync(this.modelPath, modelJson);
      return true;
    } catch (err) {
      console.error('保存模型失败:', err);
      return false;
    }
  }

  /**
   * 加载模型
   * @returns {Object|null} 加载的模型或null
   */
  loadModel() {
    try {
      if (fs.existsSync(this.modelPath)) {
        const modelJson = JSON.parse(fs.readFileSync(this.modelPath, 'utf8'));
        const model = new RandomForestRegression();
        model.fromJSON(modelJson);
        console.log('模型已加载');
        return model;
      }
    } catch (err) {
      console.error('加载模型失败:', err);
    }
    return null;
  }

  /**
   * 获取模型指标
   * @returns {Object} 模型指标
   */
  getMetrics() {
    return {
      ...this.metrics,
      sampleCount: this.trainingData.length,
      hasModel: this.model !== null,
      weights: {
        rule: this.ruleScoreWeight,
        model: this.modelScoreWeight,
        cloud: this.cloudScoreWeight
      }
    };
  }

  /**
   * 重置模型和训练数据
   * @returns {boolean} 重置是否成功
   */
  reset() {
    try {
      this.trainingData = [];
      this.model = null;
      
      // 删除文件
      if (fs.existsSync(this.modelPath)) {
        fs.unlinkSync(this.modelPath);
      }
      if (fs.existsSync(this.trainingDataPath)) {
        fs.unlinkSync(this.trainingDataPath);
      }
      
      // 重置指标
      this.metrics = {
        sampleCount: 0,
        lastTrainingTime: null,
        trainingSamples: 0,
        averageError: 0,
        confidenceScore: 0,
        scoreDistribution: {}
      };
      
      // 重置权重
      this.updateWeights();
      
      return true;
    } catch (err) {
      console.error('重置模型失败:', err);
      return false;
    }
  }

  // 辅助方法
  
  /**
   * 扁平化对象的键
   * @param {Object} obj - 要扁平化的对象
   * @returns {Array} 扁平化后的键数组
   */
  flattenKeys(obj, prefix = '') {
    let keys = [];
    
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        const newKey = prefix ? `${prefix}.${key}` : key;
        
        if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
          keys = [...keys, ...this.flattenKeys(obj[key], newKey)];
        } else {
          keys.push(newKey);
        }
      }
    }
    
    return keys;
  }

  /**
   * 扁平化对象
   * @param {Object} obj - 要扁平化的对象
   * @returns {Object} 扁平化后的对象
   */
  flattenObject(obj, prefix = '') {
    const result = {};
    
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        const newKey = prefix ? `${prefix}.${key}` : key;
        
        if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
          Object.assign(result, this.flattenObject(obj[key], newKey));
        } else {
          result[newKey] = obj[key];
        }
      }
    }
    
    return result;
  }

  /**
   * 提取对象中所有值的类型
   * @param {Object} obj - 要分析的对象
   * @returns {Object} 键到类型的映射
   */
  extractTypes(obj) {
    const result = {};
    const flat = this.flattenObject(obj);
    
    for (const key in flat) {
      if (flat.hasOwnProperty(key)) {
        const value = flat[key];
        if (Array.isArray(value)) {
          result[key] = 'array';
        } else {
          result[key] = typeof value;
        }
      }
    }
    
    return result;
  }

  /**
   * 查找对象中的所有数组
   * @param {Object} obj - 要分析的对象
   * @returns {Object} 路径到数组的映射
   */
  findArrays(obj, path = '') {
    const result = {};
    
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        const newPath = path ? `${path}.${key}` : key;
        
        if (Array.isArray(obj[key])) {
          result[newPath] = obj[key];
        } else if (typeof obj[key] === 'object' && obj[key] !== null) {
          Object.assign(result, this.findArrays(obj[key], newPath));
        }
      }
    }
    
    return result;
  }
}

module.exports = APIScoreModel;