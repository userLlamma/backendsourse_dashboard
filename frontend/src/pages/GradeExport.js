// frontend/src/pages/GradeExport.js
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';

const GradeExport = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [studentCount, setStudentCount] = useState(0);
  
  // 导出选项
  const [format, setFormat] = useState('excel');
  const [testWeight, setTestWeight] = useState(0.8);
  const [participationWeight, setParticipationWeight] = useState(0.2);
  
  // 获取学生数量
  useEffect(() => {
    const fetchStudentCount = async () => {
      try {
        const response = await axios.get('/api/students');
        setStudentCount(response.data.length);
      } catch (err) {
        setError('获取学生数据失败');
        console.error(err);
      }
    };
    
    fetchStudentCount();
  }, []);
  
  // 导出成绩
  const handleExport = async () => {
    try {
      setLoading(true);
      
      // 构建查询参数
      const params = {
        format,
        testWeight,
        participationWeight
      };
      
      // 使用 axios 发送请求，axios 会自动带上 Authorization 头
      const response = await axios.get('/api/export/grades', { 
        params,
        responseType: 'blob' // 重要：设置响应类型为 blob
      });
      
      // 创建下载链接
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `API课程成绩.${format === 'excel' ? 'xlsx' : 'csv'}`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      setLoading(false);
    } catch (err) {
      setError('导出失败: ' + (err.response?.data?.error || err.message));
      console.error(err);
      setLoading(false);
    }
  };
  
  return (
    <div className="container-fluid py-4">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h1>成绩导出</h1>
        <Link to="/students" className="btn btn-outline-secondary">
          返回学生列表
        </Link>
      </div>
      
      {error && (
        <div className="alert alert-danger" role="alert">
          {error}
        </div>
      )}
      
      <div className="row">
        <div className="col-md-4">
          <div className="card mb-4">
            <div className="card-header">
              <h5 className="mb-0">导出设置</h5>
            </div>
            <div className="card-body">
              <div className="mb-3">
                <label className="form-label">文件格式</label>
                <select 
                  className="form-select"
                  value={format}
                  onChange={(e) => setFormat(e.target.value)}
                >
                  <option value="excel">Excel表格(.xlsx)</option>
                  <option value="csv">CSV文件(.csv)</option>
                </select>
              </div>
              
              <div className="mb-3">
                <label className="form-label">成绩权重设置</label>
                <div className="alert alert-info small">
                  各权重之和应为1.0，总分100分
                </div>
                
                <div className="mb-3">
                  <label className="form-label">API测试得分权重: {testWeight}</label>
                  <input
                    type="range"
                    className="form-range"
                    min="0.5"
                    max="1"
                    step="0.1"
                    value={testWeight}
                    onChange={(e) => {
                      const newValue = parseFloat(e.target.value);
                      setTestWeight(newValue);
                      // 调整其他权重，保持总和为1
                      setParticipationWeight(Math.round((1 - newValue) * 10) / 10);
                    }}
                  />
                </div>
                
                <div className="mb-3">
                  <label className="form-label">参与度权重: {participationWeight}</label>
                  <input
                    type="range"
                    className="form-range"
                    min="0"
                    max="0.5"
                    step="0.1"
                    value={participationWeight}
                    onChange={(e) => {
                      const newValue = parseFloat(e.target.value);
                      setParticipationWeight(newValue);
                      // 调整其他权重，保持总和为1
                      setTestWeight(Math.round((1 - newValue) * 10) / 10);
                    }}
                  />
                </div>
              </div>
              
              <div className="d-grid">
                <button 
                  className="btn btn-primary"
                  onClick={handleExport}
                  disabled={loading || studentCount === 0}
                >
                  {loading ? (
                    <>
                      <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                      &nbsp;导出中...
                    </>
                  ) : '导出成绩'}
                </button>
              </div>
            </div>
          </div>
        </div>
        
        <div className="col-md-8">
          <div className="card mb-4">
            <div className="card-header">
              <h5 className="mb-0">成绩计算说明</h5>
            </div>
            <div className="card-body">
              <h6>成绩组成部分</h6>
              <ul>
                <li>
                  <strong>API测试得分 ({testWeight * 100}%)</strong> - 基于学生最后一次API测试的得分
                  <ul>
                    <li>每个测试根据通过情况计分，满分100分</li>
                    <li>API测试会验证各种端点的正确实现</li>
                    <li>未进行测试的学生该项得0分</li>
                  </ul>
                </li>
                <li>
                  <strong>参与度得分 ({participationWeight * 100}%)</strong> - 基于学生最近的活动频率
                  <ul>
                    <li>参与度得分按最后活动时间递减，最近活动得100分，每隔1天减10分</li>
                    <li>长期未活动的学生参与度得分低</li>
                  </ul>
                </li>
              </ul>
              
              <h6>最终成绩计算公式</h6>
              <div className="alert alert-secondary">
                最终成绩 = API测试得分 × {testWeight} + 参与度得分 × {participationWeight}
              </div>
              
              <h6>导出文件说明</h6>
              <p>
                导出的文件包含以下信息:
              </p>
              <ul>
                <li>学号和姓名</li>
                <li>API测试成绩和测试通过率</li>
                <li>详细的测试统计（通过测试数/总测试数）</li>
                <li>参与度得分</li>
                <li>最终加权成绩</li>
                <li>学生使用的API版本</li>
                <li>学生最后活动时间</li>
              </ul>
              
              <div className="alert alert-warning">
                <i className="bi bi-info-circle-fill me-2"></i>
                Excel格式导出会额外包含一个统计信息表，展示班级整体情况
              </div>
            </div>
            <div className="card-footer">
              <div className="d-flex align-items-center">
                <div className="me-auto">
                  <span className="badge bg-primary">学生数量: {studentCount}</span>
                </div>
                <button
                  className="btn btn-sm btn-outline-secondary me-2"
                  onClick={() => window.location.reload()}
                >
                  刷新数据
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GradeExport;