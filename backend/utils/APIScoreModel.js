// backend/utils/APIScoreModel.js
const fs = require('fs');
const path = require('path');
const { RandomForestRegression } = require('ml-random-forest');
const { Matrix } = require('ml-matrix');

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
    if (!this.model && this.trainingData.length >= this.options.minSamples) {
      console.log('模型加载失败，但有足够的训练数据，将在下次调用时训练新模型');
    }
    
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
    // 转换字符串为对象
    try {
      if (typeof studentResponse === 'string') {
        studentResponse = JSON.parse(studentResponse);
      }
      
      if (typeof referenceResponse === 'string') {
        referenceResponse = JSON.parse(referenceResponse);
      }
    } catch (err) {
      console.error('无法解析响应字符串:', err);
      // 默认返回一个特征全为0的向量
      return new Array(Object.keys(this.featureExtractors).length).fill(0);
    }
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
  async learn(studentResponse, referenceResponse, teacherScore, testCase = {}) {
    console.log('开始学习过程...');
    
    // 添加参数类型验证
    if (!studentResponse || typeof studentResponse !== 'object') {
      console.error('错误: studentResponse不是有效对象');
      return {
        added: false,
        error: '学生响应格式错误',
        currentSamples: this.trainingData.length,
        sufficientData: this.trainingData.length >= this.options.minSamples,
        autoScore: 0
      };
    }
    
    if (!referenceResponse || typeof referenceResponse !== 'object') {
      console.error('错误: referenceResponse不是有效对象');
      return {
        added: false,
        error: '参考响应格式错误',
        currentSamples: this.trainingData.length,
        sufficientData: this.trainingData.length >= this.options.minSamples,
        autoScore: 0
      };
    }
  
    try {
      // 提取特征
      console.log('提取特征...');
      const features = this.extractFeatures(studentResponse, referenceResponse, testCase);
      console.log('特征提取完成:', features);
      
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
      console.log('计算当前自动评分...');
      const autoScore = this.scoreResponse(studentResponse, referenceResponse, testCase).score;
      console.log('自动评分结果:', autoScore);
      
      // 计算评分差异
      const scoreDiff = Math.abs(teacherScore - autoScore);
      console.log('评分差异:', scoreDiff);
      
      // 只有当评分差异足够大时才添加到训练集
      // 这可以避免过多相似的样本
      const diffThreshold = 0.5;  // 分差阈值
      let added = false;
      
      if (scoreDiff >= diffThreshold || this.trainingData.length < this.options.minSamples) {
        console.log('添加新样本到训练集...');
        this.trainingData.push(sample);
        added = true;
        
        // 保存训练数据
        console.log('保存训练数据...');
        const saveResult = await this.saveTrainingData();
        console.log('训练数据保存结果:', saveResult);
        
        // 如果有足够的样本，训练模型
        if (this.trainingData.length >= this.options.minSamples) {
          console.log('尝试训练模型...');
          const trainResult = this.trainModel();
          console.log('模型训练结果:', trainResult);
        }
      } else {
        console.log('评分差异过小，不添加新样本');
      }
      
      console.log('学习过程完成');
      return {
        added,
        scoreDiff,
        currentSamples: this.trainingData.length,
        sufficientData: this.trainingData.length >= this.options.minSamples,
        autoScore
      };
    } catch (err) {
      console.error('学习过程失败:', err);
      return {
        added: false,
        error: err.message,
        currentSamples: this.trainingData.length,
        sufficientData: this.trainingData.length >= this.options.minSamples,
        autoScore: 0
      };
    }
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
      
      // 验证训练数据
      console.log('验证训练样本...');
      const validSamples = this.trainingData.filter(sample => {
        // 确保特征是数组且长度一致
        return Array.isArray(sample.features) && 
               sample.features.length > 0 &&
               sample.features.every(f => typeof f === 'number' && !isNaN(f)) &&
               typeof sample.teacherScore === 'number' && 
               !isNaN(sample.teacherScore);
      });
      
      console.log(`有效训练样本: ${validSamples.length}/${this.trainingData.length}`);
      
      if (validSamples.length < this.options.minSamples) {
        console.error(`有效样本不足: ${validSamples.length}/${this.trainingData.length}`);
        return false;
      }
      
      // 检查所有特征向量的长度是否一致
      const featureLength = validSamples[0].features.length;
      const allSameLengthFeatures = validSamples.every(
        sample => sample.features.length === featureLength
      );
      
      if (!allSameLengthFeatures) {
        console.error('特征向量长度不一致，无法训练模型');
        return false;
      }
      
      console.log(`特征向量长度: ${featureLength}`);
      
      // 准备训练数据
      try {
        // 正确导入Matrix
        const { Matrix } = require('ml-matrix');
        
        console.log('创建特征矩阵...');
        // 确保每个特征向量有相同的长度
        const X = new Matrix(validSamples.map(sample => {
          // 确保特征向量不为空且长度正确
          if (!Array.isArray(sample.features) || sample.features.length !== featureLength) {
            throw new Error(`特征向量长度不匹配: 预期${featureLength}，实际${sample.features?.length || 0}`);
          }
          return sample.features;
        }));
        
        console.log('创建标签向量...');
        const yValues = validSamples.map(sample => sample.teacherScore);
        console.log('标签值:', yValues);
        
        // 处理输入，确保他们是有效的数值
        const validYValues = yValues.map(v => {
          const num = Number(v);
          if (isNaN(num)) {
            throw new Error(`教师评分非数值: ${v}`);
          }
          return num;
        });
        
        const y = Matrix.columnVector(validYValues);
        
        console.log('创建随机森林回归模型...');
        // 正确导入RandomForestRegression
        const { RandomForestRegression } = require('ml-random-forest');
        
        const options = {
          nEstimators: 3,  // 减少树的数量，避免过拟合
          maxDepth: 2,     // 减少最大深度，简化模型
          treeOptions: {
            minNumSamples: 1  // 节点分裂所需的最小样本数
          }
        };
        
        this.model = new RandomForestRegression(options);
        console.log('开始训练模型...');
        
        // 确保矩阵维度正确
        console.log('特征矩阵维度:', X.rows, 'x', X.columns);
        console.log('标签向量维度:', y.rows, 'x', y.columns);
        
        this.model.train(X, y);
        console.log('模型训练完成');
        
        // 计算训练时间
        const trainingTime = Date.now() - startTime;
        
        // 更新指标
        this.metrics.lastTrainingTime = new Date().toISOString();
        this.metrics.trainingSamples = validSamples.length;
        this.metrics.trainingTimeMs = trainingTime;
        
        // 评估模型
        try {
          console.log('评估模型性能...');
          const predictions = this.model.predict(X);
          console.log('预测结果:', predictions);
          
          const errors = [];
          for (let i = 0; i < predictions.length; i++) {
            const error = Math.abs(predictions[i] - validYValues[i]);
            if (!isNaN(error)) {
              errors.push(error);
            }
          }
          
          const avgError = errors.length > 0 ? 
            errors.reduce((a, b) => a + b, 0) / errors.length : 0;
          
          this.metrics.averageError = avgError;
          this.metrics.confidenceScore = Math.max(0.3, 1 - avgError / 10);
          
          console.log(`平均误差: ${avgError.toFixed(2)}`);
        } catch (evalErr) {
          console.error('模型评估失败:', evalErr);
          this.metrics.averageError = 0;
          this.metrics.confidenceScore = 0.3;
        }
        
        // 保存模型
        console.log('保存模型...');
        this.saveModel();
        
        console.log(`模型训练完成 (${trainingTime}ms)，平均误差: ${this.metrics.averageError.toFixed(2)}`);
        return true;
      } catch (matrixErr) {
        console.error('矩阵操作或模型创建失败:', matrixErr);
        return false;
      }
    } catch (err) {
      console.error('模型训练失败:', err);
      return false;
    }
  }

  /**
   * 保存训练数据到文件
   * @returns {boolean} 保存是否成功
   */
  async saveTrainingData() {
    try {
      // 确保目录存在
      if (!fs.existsSync(this.options.dataDir)) {
        fs.mkdirSync(this.options.dataDir, { recursive: true });
      }
      
      // 准备数据
      const dataToSave = {
        samples: this.trainingData,
        metrics: this.metrics,
        updated: new Date().toISOString()
      };
      
      // 写入文件
      await fs.promises.writeFile(
        this.trainingDataPath,
        JSON.stringify(dataToSave, null, 2)
      );
      
      console.log(`训练数据已保存 (${this.trainingData.length}个样本)`);
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
        try {
          const data = JSON.parse(fs.readFileSync(this.trainingDataPath, 'utf8'));
          if (data && data.samples) {
            console.log(`已加载${data.samples.length}个训练样本`);
            
            if (data.metrics) {
              this.metrics = { ...this.metrics, ...data.metrics };
            }
            
            return data.samples || [];
          } else {
            console.warn('训练数据文件格式不正确，将创建新的训练数据');
            return [];
          }
        } catch (parseErr) {
          console.error('训练数据文件损坏:', parseErr);
          
          // 备份损坏的文件
          const backupPath = `${this.trainingDataPath}.backup.${Date.now()}`;
          try {
            fs.copyFileSync(this.trainingDataPath, backupPath);
            console.log(`已将损坏的训练数据文件备份到: ${backupPath}`);
          } catch (backupErr) {
            console.error('备份训练数据文件失败:', backupErr);
          }
          
          // 删除或重命名损坏的文件
          try {
            fs.unlinkSync(this.trainingDataPath);
            console.log(`已删除损坏的训练数据文件: ${this.trainingDataPath}`);
          } catch (unlinkErr) {
            console.error('删除损坏的训练数据文件失败:', unlinkErr);
          }
          
          // 返回空数组，开始新的训练
          return [];
        }
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
      // 使用模型实例的toJSON方法
      const modelJson = this.model.toJSON();
      fs.writeFileSync(this.modelPath, JSON.stringify(modelJson, null, 2), 'utf8');
      console.log(`模型已保存到: ${this.modelPath}`);
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
        console.log(`尝试从 ${this.modelPath} 加载模型...`);
        
        try {
          const modelJsonString = fs.readFileSync(this.modelPath, 'utf8');
          const modelJson = JSON.parse(modelJsonString);
          
          const { RandomForestRegression } = require('ml-random-forest');
          const model = RandomForestRegression.load(modelJson);
          
          console.log('模型已成功加载');
          return model;
        } catch (loadErr) {
          console.error('模型文件损坏或格式不兼容，将删除并重新训练:', loadErr);
          
          // 删除损坏的模型文件
          fs.unlinkSync(this.modelPath);
          
          // 返回null，系统会自动重新训练
          return null;
        }
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
  flattenObject(obj, prefix = '', seen = new WeakSet()) {
    const result = {};
    
    // 防止循环引用
    if (obj === null || typeof obj !== 'object' || seen.has(obj)) {
      return result;
    }
    
    seen.add(obj);
    
    // 设置最大递归深度
    const maxDepth = 10;
    const checkDepth = (str) => (str.match(/\./g) || []).length;
    
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        const newKey = prefix ? `${prefix}.${key}` : key;
        
        // 检查递归深度
        if (prefix && checkDepth(newKey) > maxDepth) {
          console.warn(`达到最大递归深度，跳过${newKey}`);
          continue;
        }
        
        if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
          Object.assign(result, this.flattenObject(obj[key], newKey, seen));
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