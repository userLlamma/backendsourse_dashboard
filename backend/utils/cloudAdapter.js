// backend/utils/cloudAdapter.js
const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');

/**
 * 云API适配器 - 使用云端大模型进行API响应评分
 * 支持多种API提供商，包括SiliconFlow、OpenAI和其他兼容接口
 */
class CloudAdapter {
  constructor(options = {}) {
    this.options = {
      dataDir: path.join(__dirname, '../data'),
      cacheFile: 'cloud_api_cache.json',
      enableCache: true,
      usageFile: 'cloud_api_usage.json',
      siliconflowApiKey: process.env.SILICONFLOW_API_KEY,
      openaiApiKey: process.env.OPENAI_API_KEY,
      preferredProvider: process.env.PREFERRED_CLOUD_API || 'siliconflow',
      model: process.env.CLOUD_API_MODEL || 'Qwen/QwQ-32B',  // 默认模型
      dailyLimit: parseInt(process.env.CLOUD_API_DAILY_LIMIT || '20'),
      requestTimeout: 10000,  // 10秒超时
      ...options
    };
    
    // 确保数据目录存在
    if (!fs.existsSync(this.options.dataDir)) {
      fs.mkdirSync(this.options.dataDir, { recursive: true });
    }
    
    this.cachePath = path.join(this.options.dataDir, this.options.cacheFile);
    this.usagePath = path.join(this.options.dataDir, this.options.usageFile);
    
    // 初始化缓存
    this.cache = this.loadCache();
    
    // 初始化使用统计
    this.usage = this.loadUsage();
    
    // 确保当日使用统计存在
    const today = new Date().toISOString().split('T')[0];
    if (!this.usage[today]) {
      this.usage[today] = { count: 0, tokens: 0, cost: 0 };
    }
  }

  /**
   * 获取云API评分
   * @param {Object} studentResponse - 学生的API响应
   * @param {Object} referenceResponse - 参考API响应
   * @param {Object} testCase - 测试用例信息
   * @returns {Promise<Object>} 云API评分结果
   */
  async getScore(studentResponse, referenceResponse, testCase = {}) {
    // 检查每日限额
    const today = new Date().toISOString().split('T')[0];
    if (this.usage[today].count >= this.options.dailyLimit) {
      return {
        success: false,
        error: '每日API限额已用完',
        limitExceeded: true
      };
    }
    
    // 创建缓存键
    const cacheKey = this.createCacheKey(studentResponse, referenceResponse, testCase);
    
    // 尝试从缓存获取
    if (this.options.enableCache && this.cache[cacheKey]) {
      return {
        success: true,
        score: this.cache[cacheKey].score,
        explanation: this.cache[cacheKey].explanation,
        fromCache: true
      };
    }
    
    // 准备提示
    const prompt = this.createPrompt(studentResponse, referenceResponse, testCase);
    
    try {
      let result;
      
      // 根据首选提供商选择API
      switch (this.options.preferredProvider.toLowerCase()) {
        case 'siliconflow':
          result = await this.callSiliconFlowAPI(prompt);
          break;
        case 'openai':
          result = await this.callOpenAIAPI(prompt);
          break;
        default:
          throw new Error(`未知的API提供商: ${this.options.preferredProvider}`);
      }
      
      // 解析结果
      const { score, explanation } = this.parseResponse(result);
      
      // 更新使用统计
      this.usage[today].count += 1;
      if (result.usage) {
        this.usage[today].tokens += result.usage.total_tokens || 0;
        // 假设每1000个token花费0.002元
        this.usage[today].cost += ((result.usage.total_tokens || 0) / 1000) * 0.002;
      }
      this.saveUsage();
      
      // 缓存结果
      if (this.options.enableCache) {
        this.cache[cacheKey] = { score, explanation, timestamp: new Date().toISOString() };
        this.saveCache();
      }
      
      return {
        success: true,
        score,
        explanation,
        fromCache: false
      };
    } catch (error) {
      console.error('云API评分失败:', error);
      return {
        success: false,
        error: error.message || '云API请求失败'
      };
    }
  }

  /**
   * 调用SiliconFlow API
   * @param {string} prompt - 提示文本
   * @returns {Promise<Object>} API响应
   */
  async callSiliconFlowAPI(prompt) {
    if (!this.options.siliconflowApiKey) {
      throw new Error('缺少SiliconFlow API密钥');
    }
    
    const apiUrl = 'https://api.siliconflow.cn/v1/chat/completions';
    
    const requestOptions = {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.options.siliconflowApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: this.options.model,
        messages: [
          {
            role: "system",
            content: "你是一个精确的API响应评分专家。你的任务是根据参考标准答案评估学生API响应的质量，并提供1-10分的评分和简短解释。"
          },
          {
            role: "user",
            content: prompt
          }
        ],
        stream: false,
        max_tokens: 512,
        temperature: 0.3,  // 较低温度以获得更一致的结果
        response_format: { type: "json_object" }  // 要求JSON格式响应
      }),
      timeout: this.options.requestTimeout
    };
    
    const response = await fetch(apiUrl, requestOptions);
    
    if (!response.ok) {
      throw new Error(`SiliconFlow API错误: ${response.status} ${response.statusText}`);
    }
    
    return await response.json();
  }

  /**
   * 调用OpenAI API
   * @param {string} prompt - 提示文本
   * @returns {Promise<Object>} API响应
   */
  async callOpenAIAPI(prompt) {
    if (!this.options.openaiApiKey) {
      throw new Error('缺少OpenAI API密钥');
    }
    
    const apiUrl = 'https://api.openai.com/v1/chat/completions';
    
    const requestOptions = {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.options.openaiApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',  // 使用较小模型以节省成本
        messages: [
          {
            role: "system",
            content: "你是一个精确的API响应评分专家。你的任务是根据参考标准答案评估学生API响应的质量，并提供1-10分的评分和简短解释。"
          },
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.3,
        response_format: { type: "json_object" }
      }),
      timeout: this.options.requestTimeout
    };
    
    const response = await fetch(apiUrl, requestOptions);
    
    if (!response.ok) {
      throw new Error(`OpenAI API错误: ${response.status} ${response.statusText}`);
    }
    
    return await response.json();
  }

  /**
   * 解析API响应
   * @param {Object} response - API响应
   * @returns {Object} 包含score和explanation的对象
   */
  parseResponse(response) {
    try {
      // 获取响应内容
      const content = response.choices?.[0]?.message?.content;
      
      if (!content) {
        throw new Error('API响应格式错误');
      }
      
      // 尝试解析JSON响应
      let parsedContent;
      try {
        parsedContent = JSON.parse(content);
      } catch (e) {
        // 如果不是JSON，尝试解析文本
        const scoreMatch = content.match(/分数:\s*(\d+(?:\.\d+)?)/i) || 
                           content.match(/score:\s*(\d+(?:\.\d+)?)/i);
        
        if (scoreMatch) {
          return {
            score: parseFloat(scoreMatch[1]),
            explanation: content
          };
        } else {
          throw new Error('无法从响应中提取评分');
        }
      }
      
      // 从JSON中提取分数和解释
      if (parsedContent.score !== undefined) {
        return {
          score: parseFloat(parsedContent.score),
          explanation: parsedContent.explanation || parsedContent.feedback || parsedContent.reason || ''
        };
      } else {
        throw new Error('响应中缺少score字段');
      }
    } catch (err) {
      console.error('解析API响应失败:', err, response);
      
      // 返回默认值
      return {
        score: 5,  // 中间分数作为默认值
        explanation: '无法解析API响应'
      };
    }
  }

  /**
   * 创建评分提示
   * @param {Object} studentResponse - 学生的API响应
   * @param {Object} referenceResponse - 参考API响应
   * @param {Object} testCase - 测试用例信息
   * @returns {string} 提示文本
   */
  createPrompt(studentResponse, referenceResponse, testCase) {
    // 将对象转换为格式化JSON字符串
    const studentJson = JSON.stringify(studentResponse, null, 2);
    const referenceJson = JSON.stringify(referenceResponse, null, 2);
    
    // 构建提示
    return `
作为API评分专家，请对以下API响应进行评分，范围从1到10分。
1分表示完全不符合要求，10分表示完美符合要求。

## 测试信息
- 端点: ${testCase.endpoint || '未提供'}
- 方法: ${testCase.method || '未提供'}
- 名称: ${testCase.name || '未提供'}

## 标准参考响应
\`\`\`json
${referenceJson}
\`\`\`

## 学生响应
\`\`\`json
${studentJson}
\`\`\`

## 评分标准
1. 结构正确性 (30%): 学生响应的JSON结构是否与参考答案匹配。
2. 字段完整性 (25%): 是否包含所有必要字段，字段名是否正确。
3. 数据类型正确性 (20%): 每个字段的数据类型是否正确。
4. 数据值合理性 (15%): 返回的数据值是否合理、有效。
5. 额外内容 (10%): 是否有不必要的额外字段或信息。

请以JSON格式返回评分和简短解释，格式如下:
{
  "score": 数字分数(1-10),
  "explanation": "简短解释评分理由，不超过200字"
}
`;
  }

  /**
   * 创建缓存键
   * @param {Object} studentResponse - 学生的API响应
   * @param {Object} referenceResponse - 参考API响应
   * @param {Object} testCase - 测试用例信息
   * @returns {string} 缓存键
   */
  createCacheKey(studentResponse, referenceResponse, testCase) {
    // 创建一个唯一的键，包含学生响应和测试用例的哈希
    const data = {
      student: studentResponse,
      test: {
        endpoint: testCase.endpoint,
        method: testCase.method,
        name: testCase.name
      }
    };
    
    // 简单的哈希函数
    const str = JSON.stringify(data);
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // 转换为32位整数
    }
    
    return `score_${hash}`;
  }

  /**
   * 加载缓存
   * @returns {Object} 缓存对象
   */
  loadCache() {
    try {
      if (fs.existsSync(this.cachePath)) {
        const data = JSON.parse(fs.readFileSync(this.cachePath, 'utf8'));
        console.log(`已加载${Object.keys(data).length}个云API评分缓存`);
        return data;
      }
    } catch (err) {
      console.error('加载云API缓存失败:', err);
    }
    return {};
  }

  /**
   * 保存缓存
   * @returns {boolean} 保存是否成功
   */
  saveCache() {
    try {
      fs.writeFileSync(this.cachePath, JSON.stringify(this.cache, null, 2));
      return true;
    } catch (err) {
      console.error('保存云API缓存失败:', err);
      return false;
    }
  }

  /**
   * 加载使用统计
   * @returns {Object} 使用统计对象
   */
  loadUsage() {
    try {
      if (fs.existsSync(this.usagePath)) {
        return JSON.parse(fs.readFileSync(this.usagePath, 'utf8'));
      }
    } catch (err) {
      console.error('加载云API使用统计失败:', err);
    }
    return {};
  }

  /**
   * 保存使用统计
   * @returns {boolean} 保存是否成功
   */
  saveUsage() {
    try {
      fs.writeFileSync(this.usagePath, JSON.stringify(this.usage, null, 2));
      return true;
    } catch (err) {
      console.error('保存云API使用统计失败:', err);
      return false;
    }
  }

  /**
   * 获取使用统计
   * @returns {Object} 使用统计
   */
  getUsage() {
    return {
      ...this.usage,
      dailyLimit: this.options.dailyLimit,
      preferredProvider: this.options.preferredProvider
    };
  }

  /**
   * 清除缓存
   * @returns {boolean} 清除是否成功
   */
  clearCache() {
    try {
      this.cache = {};
      if (fs.existsSync(this.cachePath)) {
        fs.unlinkSync(this.cachePath);
      }
      return true;
    } catch (err) {
      console.error('清除云API缓存失败:', err);
      return false;
    }
  }
}

module.exports = CloudAdapter;