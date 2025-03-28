// frontend/src/components/ModelStatusPanel.js
import React, { useState, useEffect } from 'react';
import axios from 'axios';

/**
 * 自动评分模型状态面板
 * 显示模型指标、云API使用情况和系统状态
 */
const ModelStatusPanel = () => {
  const [modelStatus, setModelStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [actionInProgress, setActionInProgress] = useState(false);
  
  // 获取模型状态
  const fetchModelStatus = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/auto-grading/status');
      setModelStatus(response.data);
      setError(null);
    } catch (err) {
      setError('获取模型状态失败');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };
  
  // 初始加载
  useEffect(() => {
    fetchModelStatus();
    
    // 设置定期刷新
    const interval = setInterval(fetchModelStatus, 60000); // 每分钟刷新一次
    
    return () => clearInterval(interval);
  }, []);
  
  // 训练模型
  const handleTrainModel = async () => {
    try {
      setActionInProgress(true);
      const response = await axios.post('/api/auto-grading/train');
      
      alert(response.data.message);
      fetchModelStatus();
    } catch (err) {
      setError(err.response?.data?.error || '训练模型失败');
      alert('训练失败: ' + (err.response?.data?.error || '未知错误'));
    } finally {
      setActionInProgress(false);
    }
  };
  
  // 重置模型
  const handleResetModel = async () => {
    if (!window.confirm('确定要重置模型吗？这将删除所有训练数据和学习记录!')) {
      return;
    }
    
    try {
      setActionInProgress(true);
      const response = await axios.post('/api/auto-grading/reset');
      
      alert(response.data.message);
      fetchModelStatus();
    } catch (err) {
      setError(err.response?.data?.error || '重置模型失败');
      alert('重置失败: ' + (err.response?.data?.error || '未知错误'));
    } finally {
      setActionInProgress(false);
    }
  };
  
  // 清除云API缓存
  const handleClearCache = async () => {
    try {
      setActionInProgress(true);
      const response = await axios.post('/api/auto-grading/clear-cache');
      
      alert(response.data.message);
      fetchModelStatus();
    } catch (err) {
      setError(err.response?.data?.error || '清除缓存失败');
      alert('清除缓存失败: ' + (err.response?.data?.error || '未知错误'));
    } finally {
      setActionInProgress(false);
    }
  };
  
  // 切换自动评分系统启用状态
  const handleToggleSystem = async () => {
    try {
      setActionInProgress(true);
      
      const newStatus = !modelStatus.enabled;
      const response = await axios.put('/api/auto-grading/config', {
        enabled: newStatus
      });
      
      alert(`自动评分系统已${newStatus ? '启用' : '禁用'}`);
      fetchModelStatus();
    } catch (err) {
      setError(err.response?.data?.error || '更新系统状态失败');
      alert('更新失败: ' + (err.response?.data?.error || '未知错误'));
    } finally {
      setActionInProgress(false);
    }
  };
  
  // 更新云API提供商
  const handleUpdateCloudProvider = async (provider) => {
    try {
      setActionInProgress(true);
      
      const response = await axios.put('/api/auto-grading/config', {
        cloudApi: {
          ...modelStatus.cloudApi,
          provider
        }
      });
      
      alert(`云API提供商已更新为 ${provider}`);
      fetchModelStatus();
    } catch (err) {
      setError(err.response?.data?.error || '更新云API提供商失败');
      alert('更新失败: ' + (err.response?.data?.error || '未知错误'));
    } finally {
      setActionInProgress(false);
    }
  };

  // 导出训练数据
  const handleExportTrainingData = async () => {
    try {
      setActionInProgress(true);
      
      // 使用window.open直接下载文件
      window.open('/api/auto-grading/export-training-data', '_blank');
      
    } catch (err) {
      setError(err.response?.data?.error || '导出训练数据失败');
      alert('导出失败: ' + (err.response?.data?.error || '未知错误'));
    } finally {
      setActionInProgress(false);
    }
  };
  
  if (loading && !modelStatus) {
    return (
      <div className="card">
        <div className="card-body">
          <div className="d-flex justify-content-center">
            <div className="spinner-border text-primary" role="status">
              <span className="visually-hidden">Loading...</span>
            </div>
            <span className="ms-2">加载模型状态中...</span>
          </div>
        </div>
      </div>
    );
  }
  
  if (error && !modelStatus) {
    return (
      <div className="card">
        <div className="card-body">
          <div className="alert alert-danger" role="alert">
            {error}
          </div>
          <button
            className="btn btn-primary"
            onClick={fetchModelStatus}
          >
            重试
          </button>
        </div>
      </div>
    );
  }
  
  if (!modelStatus) {
    return null;
  }
  
  return (
    <div className="card">
      <div className="card-header bg-primary text-white">
        <div className="d-flex justify-content-between align-items-center">
          <h5 className="mb-0">自动评分系统状态</h5>
          <div>
            <span className={`badge bg-${modelStatus.enabled ? 'success' : 'danger'} me-2`}>
              {modelStatus.enabled ? '已启用' : '已禁用'}
            </span>
            <button
              className="btn btn-sm btn-light"
              onClick={fetchModelStatus}
              disabled={loading}
            >
              <i className="bi bi-arrow-repeat"></i>
            </button>
          </div>
        </div>
      </div>
      
      <div className="card-body">
        <ul className="nav nav-tabs mb-3">
          <li className="nav-item">
            <button
              className={`nav-link ${activeTab === 'overview' ? 'active' : ''}`}
              onClick={() => setActiveTab('overview')}
            >
              概览
            </button>
          </li>
          <li className="nav-item">
            <button
              className={`nav-link ${activeTab === 'model' ? 'active' : ''}`}
              onClick={() => setActiveTab('model')}
            >
              模型详情
            </button>
          </li>
          <li className="nav-item">
            <button
              className={`nav-link ${activeTab === 'cloud' ? 'active' : ''}`}
              onClick={() => setActiveTab('cloud')}
            >
              云API状态
            </button>
          </li>
          <li className="nav-item">
            <button
              className={`nav-link ${activeTab === 'references' ? 'active' : ''}`}
              onClick={() => setActiveTab('references')}
            >
              参考解决方案
            </button>
          </li>
          <li className="nav-item">
            <button
              className={`nav-link ${activeTab === 'training' ? 'active' : ''}`}
              onClick={() => setActiveTab('training')}
            >
              训练数据
            </button>
          </li>
        </ul>
        
        {activeTab === 'overview' && (
          <div>
            <div className="row mb-4">
              <div className="col-md-6">
                <div className="card h-100">
                  <div className="card-header">
                    <h6 className="mb-0">系统状态</h6>
                  </div>
                  <div className="card-body">
                    <div className="d-flex justify-content-between mb-3">
                      <div>状态:</div>
                      <div>
                        <span className={`badge bg-${modelStatus.enabled ? 'success' : 'danger'}`}>
                          {modelStatus.enabled ? '已启用' : '已禁用'}
                        </span>
                      </div>
                    </div>
                    
                    <div className="d-flex justify-content-between mb-3">
                      <div>模型样本数:</div>
                      <div>
                        <strong>{modelStatus.model.sampleCount || 0}</strong>
                        <span className="ms-2 badge bg-secondary">
                          {modelStatus.model.sampleCount >= 3 ? '训练就绪' : '样本不足'}
                        </span>
                      </div>
                    </div>
                    
                    <div className="d-flex justify-content-between mb-3">
                      <div>模型准确率:</div>
                      <div>
                        {modelStatus.model.settings.accuracy ? (
                          <span className={`badge ${
                            modelStatus.model.settings.accuracy > 0.8 ? 'bg-success' : 
                            modelStatus.model.settings.accuracy > 0.6 ? 'bg-warning' : 'bg-danger'
                          }`}>
                            {Math.round(modelStatus.model.settings.accuracy * 100)}%
                          </span>
                        ) : (
                          <span className="text-muted">未知</span>
                        )}
                      </div>
                    </div>
                    
                    <div className="d-flex justify-content-between">
                      <div>最后训练时间:</div>
                      <div>
                        {modelStatus.model.settings.lastTrainingTime ? (
                          new Date(modelStatus.model.settings.lastTrainingTime).toLocaleString()
                        ) : (
                          <span className="text-muted">未训练</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="card-footer">
                    <button
                      className="btn btn-primary btn-sm w-100"
                      onClick={handleToggleSystem}
                      disabled={actionInProgress}
                    >
                      {modelStatus.enabled ? '禁用系统' : '启用系统'}
                    </button>
                  </div>
                </div>
              </div>
              <div className="col-md-6">
                <div className="card h-100">
                  <div className="card-header">
                    <h6 className="mb-0">评分统计</h6>
                  </div>
                  <div className="card-body">
                    <div className="d-flex justify-content-between mb-3">
                      <div>总评分次数:</div>
                      <div>
                        <strong>{modelStatus.stats.totalEvaluations || 0}</strong>
                      </div>
                    </div>
                    
                    <div className="d-flex justify-content-between mb-3">
                      <div>教师修正次数:</div>
                      <div>
                        <strong>{modelStatus.stats.teacherOverrides || 0}</strong>
                        <small className="ms-2 text-muted">
                          {modelStatus.stats.totalEvaluations ? 
                            `(${Math.round((modelStatus.stats.teacherOverrides / modelStatus.stats.totalEvaluations) * 100)}%)` : 
                            '(0%)'}
                        </small>
                      </div>
                    </div>
                    
                    <div className="d-flex justify-content-between mb-3">
                      <div>云API调用次数:</div>
                      <div>
                        <strong>{modelStatus.stats.cloudApiCalls || 0}</strong>
                      </div>
                    </div>
                    
                    <div className="d-flex justify-content-between">
                      <div>参考解决方案:</div>
                      <div>
                        <strong>{modelStatus.referenceSolutions?.length || 0}</strong>
                      </div>
                    </div>
                  </div>
                  <div className="card-footer">
                    <div className="text-center text-muted small">
                      最后更新: {new Date().toLocaleTimeString()}
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="alert alert-info">
              <h6>自动评分系统状态</h6>
              <p className="mb-0">
                当前策略: 
                {modelStatus.model.sampleCount < 3 ? (
                  <span className="badge bg-warning ms-2">冷启动 (规则评分 + 云API)</span>
                ) : modelStatus.model.sampleCount < 20 ? (
                  <span className="badge bg-info ms-2">成长阶段 (规则 + 模型 + 云API)</span>
                ) : (
                  <span className="badge bg-success ms-2">成熟阶段 (主要依靠本地模型)</span>
                )}
              </p>
              <div className="progress mt-2" style={{ height: '8px' }}>
                <div 
                  className="progress-bar bg-success" 
                  role="progressbar" 
                  style={{ width: `${Math.min(100, (modelStatus.model.sampleCount / 20) * 100)}%` }}
                  aria-valuenow={modelStatus.model.sampleCount} 
                  aria-valuemin="0" 
                  aria-valuemax="20"
                ></div>
              </div>
              <div className="d-flex justify-content-between mt-1">
                <span className="small">冷启动</span>
                <span className="small">成长期</span>
                <span className="small">成熟期</span>
              </div>
            </div>
          </div>
        )}
        
        {activeTab === 'model' && (
          <div>
            <div className="row mb-4">
              <div className="col-md-6">
                <div className="card">
                  <div className="card-header">
                    <h6 className="mb-0">模型指标</h6>
                  </div>
                  <div className="card-body">
                    <table className="table table-sm">
                      <tbody>
                        <tr>
                          <td>训练样本数:</td>
                          <td><strong>{modelStatus.model.sampleCount || 0}</strong></td>
                        </tr>
                        <tr>
                          <td>最近训练时间:</td>
                          <td>
                            {modelStatus.model.lastTrainingTime ? 
                              new Date(modelStatus.model.lastTrainingTime).toLocaleString() : 
                              '无训练记录'}
                          </td>
                        </tr>
                        <tr>
                          <td>模型置信度:</td>
                          <td>
                            {modelStatus.model.confidenceScore ? 
                              `${Math.round(modelStatus.model.confidenceScore * 100)}%` : 
                              '未知'}
                          </td>
                        </tr>
                        <tr>
                          <td>平均误差:</td>
                          <td>
                            {modelStatus.model.averageError ? 
                              `${modelStatus.model.averageError.toFixed(2)}分` : 
                              '未知'}
                          </td>
                        </tr>
                        <tr>
                          <td>训练耗时:</td>
                          <td>
                            {modelStatus.model.trainingTimeMs ? 
                              `${modelStatus.model.trainingTimeMs}ms` : 
                              '未知'}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
              
              <div className="col-md-6">
                <div className="card">
                  <div className="card-header">
                    <h6 className="mb-0">当前评分权重</h6>
                  </div>
                  <div className="card-body">
                    <h5>权重分布</h5>
                    <div className="progress mb-3" style={{ height: '25px' }}>
                      <div 
                        className="progress-bar bg-primary" 
                        role="progressbar" 
                        style={{ width: `${(modelStatus.model.weights?.model || 0.1) * 100}%` }}
                        aria-valuenow={(modelStatus.model.weights?.model || 0.1) * 100} 
                        aria-valuemin="0" 
                        aria-valuemax="100"
                      >
                        模型 ({Math.round((modelStatus.model.weights?.model || 0.1) * 100)}%)
                      </div>
                      <div 
                        className="progress-bar bg-success" 
                        role="progressbar" 
                        style={{ width: `${(modelStatus.model.weights?.rule || 0.3) * 100}%` }}
                        aria-valuenow={(modelStatus.model.weights?.rule || 0.3) * 100} 
                        aria-valuemin="0" 
                        aria-valuemax="100"
                      >
                        规则 ({Math.round((modelStatus.model.weights?.rule || 0.3) * 100)}%)
                      </div>
                      <div 
                        className="progress-bar bg-info" 
                        role="progressbar" 
                        style={{ width: `${(modelStatus.model.weights?.cloud || 0.6) * 100}%` }}
                        aria-valuenow={(modelStatus.model.weights?.cloud || 0.6) * 100} 
                        aria-valuemin="0" 
                        aria-valuemax="100"
                      >
                        云API ({Math.round((modelStatus.model.weights?.cloud || 0.6) * 100)}%)
                      </div>
                    </div>
                    
                    <div className="alert alert-info">
                      <i className="bi bi-info-circle me-2"></i>
                      随着训练样本增加，权重会自动调整。当样本数量达到20个以上时，本地模型将成为主要评分来源。
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="card mb-4">
              <div className="card-header">
                <h6 className="mb-0">特征重要性</h6>
              </div>
              <div className="card-body">
                <div className="table-responsive">
                  <table className="table table-sm table-hover">
                    <thead>
                      <tr>
                        <th>特征名称</th>
                        <th>权重</th>
                        <th>描述</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td>结构相似度</td>
                        <td>
                          <div className="progress" style={{ height: '5px' }}>
                            <div 
                              className="progress-bar bg-primary" 
                              role="progressbar" 
                              style={{ width: `${0.25 * 100}%` }}
                            ></div>
                          </div>
                          <span className="small">25%</span>
                        </td>
                        <td>API响应的结构是否与参考答案匹配</td>
                      </tr>
                      <tr>
                        <td>类型匹配</td>
                        <td>
                          <div className="progress" style={{ height: '5px' }}>
                            <div 
                              className="progress-bar bg-primary" 
                              role="progressbar" 
                              style={{ width: `${0.15 * 100}%` }}
                            ></div>
                          </div>
                          <span className="small">15%</span>
                        </td>
                        <td>字段的数据类型是否正确</td>
                      </tr>
                      <tr>
                        <td>值相似度</td>
                        <td>
                          <div className="progress" style={{ height: '5px' }}>
                            <div 
                              className="progress-bar bg-primary" 
                              role="progressbar" 
                              style={{ width: `${0.25 * 100}%` }}
                            ></div>
                          </div>
                          <span className="small">25%</span>
                        </td>
                        <td>字段值的内容是否与参考答案相似</td>
                      </tr>
                      <tr>
                        <td>完整性</td>
                        <td>
                          <div className="progress" style={{ height: '5px' }}>
                            <div 
                              className="progress-bar bg-primary" 
                              role="progressbar" 
                              style={{ width: `${0.15 * 100}%` }}
                            ></div>
                          </div>
                          <span className="small">15%</span>
                        </td>
                        <td>是否包含所有必要字段</td>
                      </tr>
                      <tr>
                        <td>数组长度匹配</td>
                        <td>
                          <div className="progress" style={{ height: '5px' }}>
                            <div 
                              className="progress-bar bg-primary" 
                              role="progressbar" 
                              style={{ width: `${0.10 * 100}%` }}
                            ></div>
                          </div>
                          <span className="small">10%</span>
                        </td>
                        <td>数组类型字段的长度是否接近</td>
                      </tr>
                      <tr>
                        <td>额外字段</td>
                        <td>
                          <div className="progress" style={{ height: '5px' }}>
                            <div 
                              className="progress-bar bg-primary" 
                              role="progressbar" 
                              style={{ width: `${0.05 * 100}%` }}
                            ></div>
                          </div>
                          <span className="small">5%</span>
                        </td>
                        <td>是否包含不必要的额外字段</td>
                      </tr>
                      <tr>
                        <td>状态码匹配</td>
                        <td>
                          <div className="progress" style={{ height: '5px' }}>
                            <div 
                              className="progress-bar bg-primary" 
                              role="progressbar" 
                              style={{ width: `${0.05 * 100}%` }}
                            ></div>
                          </div>
                          <span className="small">5%</span>
                        </td>
                        <td>HTTP状态码是否符合预期</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                
                <div className="alert alert-secondary mt-3">
                  <p className="mb-0 small">
                    <i className="bi bi-info-circle me-2"></i>
                    以上是规则评分的初始权重。随着模型学习，特征重要性会动态调整。
                  </p>
                </div>
              </div>
            </div>
            
            <div className="d-flex justify-content-between">
              <button
                className="btn btn-primary"
                onClick={handleTrainModel}
                disabled={actionInProgress || modelStatus.model.sampleCount < 3}
              >
                {actionInProgress ? '处理中...' : '手动训练模型'}
              </button>
              
              <button
                className="btn btn-danger"
                onClick={handleResetModel}
                disabled={actionInProgress}
              >
                {actionInProgress ? '处理中...' : '重置模型'}
              </button>
            </div>
          </div>
        )}
        
        {activeTab === 'cloud' && (
          <div>
            <div className="row mb-4">
              <div className="col-md-6">
                <div className="card">
                  <div className="card-header">
                    <h6 className="mb-0">云API配置</h6>
                  </div>
                  <div className="card-body">
                    <div className="mb-3">
                      <div className="d-flex justify-content-between">
                        <span>状态:</span>
                        <span>
                          <span className={`badge ${modelStatus.cloudApi.enabled ? 'bg-success' : 'bg-danger'}`}>
                            {modelStatus.cloudApi.enabled ? '已启用' : '已禁用'}
                          </span>
                        </span>
                      </div>
                    </div>
                    
                    <div className="mb-3">
                      <div className="d-flex justify-content-between">
                        <span>首选提供商:</span>
                        <span>
                          <strong>
                            {modelStatus.cloudApi.provider === 'siliconflow' ? 'SiliconFlow' : 
                             modelStatus.cloudApi.provider === 'openai' ? 'OpenAI' : 
                             modelStatus.cloudApi.provider}
                          </strong>
                        </span>
                      </div>
                    </div>
                    
                    <div className="mb-3">
                      <div className="d-flex justify-content-between">
                        <span>每日调用限制:</span>
                        <span>
                          <strong>{modelStatus.cloudApi.dailyLimit || 0}</strong> 次
                        </span>
                      </div>
                    </div>
                    
                    <div className="mb-3">
                      <div className="d-flex justify-content-between">
                        <span>使用的模型:</span>
                        <span>
                          <code>{modelStatus.cloudApi.model || '默认'}</code>
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="card-footer">
                    <div className="btn-group w-100" role="group">
                      <button
                        className={`btn btn-sm ${modelStatus.cloudApi.provider === 'siliconflow' ? 'btn-primary' : 'btn-outline-primary'}`}
                        onClick={() => handleUpdateCloudProvider('siliconflow')}
                        disabled={actionInProgress || modelStatus.cloudApi.provider === 'siliconflow'}
                      >
                        SiliconFlow
                      </button>
                      <button
                        className={`btn btn-sm ${modelStatus.cloudApi.provider === 'openai' ? 'btn-primary' : 'btn-outline-primary'}`}
                        onClick={() => handleUpdateCloudProvider('openai')}
                        disabled={actionInProgress || modelStatus.cloudApi.provider === 'openai'}
                      >
                        OpenAI
                      </button>
                      <button
                        className={`btn btn-sm ${modelStatus.cloudApi.provider === 'none' ? 'btn-primary' : 'btn-outline-primary'}`}
                        onClick={() => handleUpdateCloudProvider('none')}
                        disabled={actionInProgress || modelStatus.cloudApi.provider === 'none'}
                      >
                        不使用
                      </button>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="col-md-6">
                <div className="card">
                  <div className="card-header">
                    <h6 className="mb-0">今日使用情况</h6>
                  </div>
                  <div className="card-body">
                    {(() => {
                      // 找到今天的使用记录
                      const today = new Date().toISOString().split('T')[0];
                      const todayUsage = (modelStatus.cloudApi.usage || {})[today] || { count: 0, tokens: 0, cost: 0 };
                      
                      return (
                        <div>
                          <div className="mb-3">
                            <div className="d-flex justify-content-between">
                              <span>API调用次数:</span>
                              <span>
                                <strong>{todayUsage.count}</strong> / {modelStatus.cloudApi.dailyLimit || 0}
                              </span>
                            </div>
                            <div className="progress mt-1" style={{ height: '5px' }}>
                              <div 
                                className="progress-bar bg-primary" 
                                role="progressbar" 
                                style={{ width: `${modelStatus.cloudApi.dailyLimit ? (todayUsage.count / modelStatus.cloudApi.dailyLimit) * 100 : 0}%` }}
                              ></div>
                            </div>
                          </div>
                          
                          <div className="mb-3">
                            <div className="d-flex justify-content-between">
                              <span>消耗的Token:</span>
                              <span>
                                <strong>{todayUsage.tokens?.toLocaleString() || 0}</strong>
                              </span>
                            </div>
                          </div>
                          
                          <div className="mb-3">
                            <div className="d-flex justify-content-between">
                              <span>估计成本:</span>
                              <span>
                                <strong>${todayUsage.cost?.toFixed(5) || 0}</strong> USD
                              </span>
                            </div>
                          </div>
                          
                          <div className="mb-3">
                            <div className="d-flex justify-content-between">
                              <span>剩余API配额:</span>
                              <span>
                                <strong>{Math.max(0, (modelStatus.cloudApi.dailyLimit || 0) - todayUsage.count)}</strong> 次
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                  <div className="card-footer">
                    <button 
                      className="btn btn-warning btn-sm w-100"
                      onClick={handleClearCache}
                      disabled={actionInProgress}
                    >
                      清除API缓存
                    </button>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="card">
              <div className="card-header">
                <h6 className="mb-0">API使用历史记录</h6>
              </div>
              <div className="card-body">
                <div className="table-responsive">
                  <table className="table table-sm table-hover">
                    <thead>
                      <tr>
                        <th>日期</th>
                        <th>API调用次数</th>
                        <th>Token使用量</th>
                        <th>估计成本</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(() => {
                        // 获取使用历史
                        const usage = modelStatus.cloudApi.usage || {};
                        const dates = Object.keys(usage).sort().reverse();
                        
                        if (dates.length === 0) {
                          return (
                            <tr>
                              <td colSpan="4" className="text-center">暂无使用记录</td>
                            </tr>
                          );
                        }
                        
                        return dates.slice(0, 7).map(date => {
                          const dayUsage = usage[date] || { count: 0, tokens: 0, cost: 0 };
                          return (
                            <tr key={date}>
                              <td>{date}</td>
                              <td>{dayUsage.count}</td>
                              <td>{dayUsage.tokens?.toLocaleString() || 0}</td>
                              <td>${dayUsage.cost?.toFixed(5) || 0}</td>
                            </tr>
                          );
                        });
                      })()}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}
        
        {activeTab === 'references' && (
          <div>
            <div className="alert alert-info mb-4">
              <h6><i className="bi bi-info-circle-fill me-2"></i>参考解决方案</h6>
              <p className="mb-0">
                参考解决方案是用于评估学生API响应的基准答案。每个API测试用例需要设置一个参考解决方案。
                通常选择优秀学生的API响应作为参考标准。
              </p>
            </div>
            
            <div className="card">
              <div className="card-header">
                <h6 className="mb-0">已配置的参考解决方案</h6>
              </div>
              <div className="card-body">
                {modelStatus.referenceSolutions && modelStatus.referenceSolutions.length > 0 ? (
                  <div className="table-responsive">
                    <table className="table table-sm table-hover">
                      <thead>
                        <tr>
                          <th>测试名称</th>
                          <th>端点</th>
                          <th>方法</th>
                          <th>参考学生</th>
                          <th>设置时间</th>
                        </tr>
                      </thead>
                      <tbody>
                        {modelStatus.referenceSolutions.map((solution, index) => (
                          <tr key={index}>
                            <td>{solution.testName}</td>
                            <td><code>{solution.endpoint}</code></td>
                            <td><code>{solution.method}</code></td>
                            <td>{solution.studentId}</td>
                            <td>
                              {solution.responseId && !isNaN(parseInt(solution.responseId)) ? 
                                new Date(parseInt(solution.responseId)).toLocaleString() : 
                                '未知'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="alert alert-warning">
                    尚未配置任何参考解决方案。在学生详情页的测试结果中，可将优秀学生的答案设为参考解决方案。
                  </div>
                )}
              </div>
            </div>
            
            <div className="card mt-4">
              <div className="card-header">
                <h6 className="mb-0">设置参考解决方案指南</h6>
              </div>
              <div className="card-body">
                <ol>
                  <li>
                    <strong>选择优秀学生答案</strong> - 在学生详情页面查看测试结果，找到符合预期的API响应。
                  </li>
                  <li>
                    <strong>设置为参考标准</strong> - 点击测试详情中的"设为参考解决方案"按钮。
                  </li>
                  <li>
                    <strong>验证设置</strong> - 设置完成后，回到此页面确认参考解决方案已正确配置。
                  </li>
                </ol>
                
                <div className="alert alert-secondary mt-3">
                  <p className="mb-0 small">
                    <i className="bi bi-lightbulb me-2"></i>
                    <strong>提示:</strong> 对于每个API测试，只需设置一个参考解决方案。如果设置了多个相同测试的参考解决方案，将使用最新设置的那个。
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'training' && (
          <div>
            <div className="alert alert-info mb-4">
              <h6><i className="bi bi-database-fill me-2"></i>训练数据管理</h6>
              <p className="mb-0">
                系统会自动保存训练数据，包括教师评分记录、云API评分和自动评分结果。这些数据用于提高模型准确性。
              </p>
            </div>
            
            <div className="row mb-4">
              <div className="col-md-6">
                <div className="card">
                  <div className="card-header">
                    <h6 className="mb-0">数据统计</h6>
                  </div>
                  <div className="card-body">
                    {modelStatus.trainingStats ? (
                      <div>
                        <div className="d-flex justify-content-between mb-3">
                          <span>教师评分记录:</span>
                          <strong>{modelStatus.trainingStats.teacherScoreCount || 0}</strong>
                        </div>
                        <div className="d-flex justify-content-between mb-3">
                          <span>云API评分记录:</span>
                          <strong>{modelStatus.trainingStats.cloudApiScoreCount || 0}</strong>
                        </div>
                        <div className="d-flex justify-content-between mb-3">
                          <span>自动评分结果:</span>
                          <strong>{modelStatus.trainingStats.autoGradingResultCount || 0}</strong>
                        </div>
                        <div className="d-flex justify-content-between mb-3">
                          <span>总记录数:</span>
                          <strong>{modelStatus.trainingStats.totalRecords || 0}</strong>
                        </div>
                        <div className="d-flex justify-content-between">
                          <span>最后更新:</span>
                          <span>
                            {modelStatus.trainingStats.lastUpdated ? 
                              new Date(modelStatus.trainingStats.lastUpdated).toLocaleString() : 
                              '未知'}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="alert alert-warning">
                        无法获取训练数据统计信息
                      </div>
                    )}
                  </div>
                </div>
              </div>
              
              <div className="col-md-6">
                <div className="card">
                  <div className="card-header">
                    <h6 className="mb-0">最近的教师评分</h6>
                  </div>
                  <div className="card-body">
                    {modelStatus.trainingStats && modelStatus.trainingStats.recentTeacherScores && 
                     modelStatus.trainingStats.recentTeacherScores.length > 0 ? (
                      <div className="table-responsive">
                        <table className="table table-sm">
                          <thead>
                            <tr>
                              <th>测试名称</th>
                              <th>教师评分</th>
                              <th>差异</th>
                              <th>时间</th>
                            </tr>
                          </thead>
                          <tbody>
                            {modelStatus.trainingStats.recentTeacherScores.map((score, index) => (
                              <tr key={index}>
                                <td>{score.testName}</td>
                                <td>{score.teacherScore}</td>
                                <td>
                                  {score.scoreDiff && (
                                    <span className={`badge ${score.scoreDiff > 2 ? 'bg-danger' : 
                                                             score.scoreDiff > 1 ? 'bg-warning' : 'bg-success'}`}>
                                      {score.scoreDiff.toFixed(1)}
                                    </span>
                                  )}
                                </td>
                                <td>
                                  {score.timestamp ? 
                                    new Date(score.timestamp).toLocaleString() : 
                                    '未知'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="alert alert-warning">
                        暂无教师评分记录
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="card mb-4">
              <div className="card-header">
                <h6 className="mb-0">测试类型统计</h6>
              </div>
              <div className="card-body">
                {modelStatus.trainingStats && modelStatus.trainingStats.testStats && 
                 modelStatus.trainingStats.testStats.length > 0 ? (
                  <div className="table-responsive">
                    <table className="table table-sm table-hover">
                      <thead>
                        <tr>
                          <th>测试名称</th>
                          <th>评分数量</th>
                          <th>平均分数</th>
                          <th>平均差异</th>
                        </tr>
                      </thead>
                      <tbody>
                        {modelStatus.trainingStats.testStats.map((stat, index) => (
                          <tr key={index}>
                            <td>{stat._id}</td>
                            <td>{stat.count}</td>
                            <td>{stat.avgScore?.toFixed(2) || '-'}</td>
                            <td>
                              {stat.avgDiff !== undefined ? (
                                <span className={`badge ${stat.avgDiff > 2 ? 'bg-danger' : 
                                                         stat.avgDiff > 1 ? 'bg-warning' : 'bg-success'}`}>
                                  {stat.avgDiff.toFixed(2)}
                                </span>
                              ) : '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="alert alert-warning">
                    暂无测试类型统计数据
                  </div>
                )}
              </div>
            </div>
            
            <div className="d-flex justify-content-between">
              <button
                className="btn btn-primary"
                onClick={handleExportTrainingData}
                disabled={actionInProgress || 
                          !(modelStatus.trainingStats && modelStatus.trainingStats.totalRecords > 0)}
              >
                {actionInProgress ? '处理中...' : '导出训练数据'}
              </button>
              
              <div className="btn-group">
                <button
                  className="btn btn-warning"
                  onClick={handleTrainModel}
                  disabled={actionInProgress || modelStatus.model.sampleCount < 3}
                >
                  {actionInProgress ? '处理中...' : '重新训练模型'}
                </button>
                
                <button
                  className="btn btn-danger"
                  onClick={handleResetModel}
                  disabled={actionInProgress}
                >
                  {actionInProgress ? '处理中...' : '重置模型'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
      
      <div className="card-footer text-muted">
        <div className="d-flex justify-content-between align-items-center">
          <span>
            自动评分系统状态: 
            <span className={`badge ms-2 ${modelStatus.enabled ? 'bg-success' : 'bg-danger'}`}>
              {modelStatus.enabled ? '活跃' : '未启用'}
            </span>
          </span>
          <span>
            模型版本: v1.0.0
          </span>
        </div>
      </div>
    </div>
  );
};

export default ModelStatusPanel;