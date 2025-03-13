// frontend/src/pages/Dashboard.js
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';

const Dashboard = () => {
  const [stats, setStats] = useState(null);
  const [recentStudents, setRecentStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshInterval, setRefreshInterval] = useState(30); // 秒
  const [lastRefresh, setLastRefresh] = useState('');
  
  const fetchData = async () => {
    try {
      setLoading(true);
      
      // 获取统计数据
      const statsRes = await axios.get('/api/dashboard/stats');
      setStats(statsRes.data);
      
      // 获取学生列表(进行分类)
      const studentsRes = await axios.get('/api/students');
      
      // 按最后报告时间排序，获取最新的5个
      const sortedStudents = [...studentsRes.data].sort((a, b) => 
        new Date(b.lastReportTime) - new Date(a.lastReportTime)
      ).slice(0, 5);
      
      setRecentStudents(sortedStudents);
      setLastRefresh(new Date().toLocaleTimeString());
      setError(null);
    } catch (err) {
      setError('获取数据失败');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };
  
  useEffect(() => {
    fetchData();
    
    // 设置定时刷新
    const interval = setInterval(fetchData, refreshInterval * 1000);
    
    return () => clearInterval(interval);
  }, [refreshInterval]);
  
  const handleRefreshChange = (e) => {
    const value = parseInt(e.target.value);
    setRefreshInterval(value);
  };
  
  if (loading && !stats) {
    return (
      <div className="d-flex justify-content-center my-5">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
        <span className="ms-2">加载数据中...</span>
      </div>
    );
  }
  
  return (
    <div className="container-fluid py-4">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h1>课程监控仪表板</h1>
        
        <div className="d-flex align-items-center">
          <div className="me-3">
            <select 
              className="form-select" 
              value={refreshInterval} 
              onChange={handleRefreshChange}
              aria-label="刷新间隔"
            >
              <option value="10">10秒刷新</option>
              <option value="30">30秒刷新</option>
              <option value="60">1分钟刷新</option>
              <option value="300">5分钟刷新</option>
            </select>
          </div>
          
          <button className="btn btn-primary" onClick={fetchData}>
            <i className="bi bi-arrow-clockwise"></i> 刷新
          </button>
        </div>
      </div>
      
      {error && (
        <div className="alert alert-danger" role="alert">
          {error}
        </div>
      )}
      
      {stats && (
        <div className="row mb-4">
          <div className="col-md-3">
            <div className="card text-center h-100">
              <div className="card-body">
                <h5 className="card-title">总学生数</h5>
                <p className="card-text display-4">{stats.totalStudents}</p>
              </div>
            </div>
          </div>
          
          <div className="col-md-3">
            <div className="card text-center h-100">
              <div className="card-body">
                <h5 className="card-title">在线学生</h5>
                <p className="card-text display-4">{stats.onlineStudents}</p>
                <span className="badge bg-success">
                  {Math.round((stats.onlineStudents / stats.totalStudents) * 100) || 0}%
                </span>
              </div>
            </div>
          </div>
          
          <div className="col-md-3">
            <div className="card text-center h-100">
              <div className="card-body">
                <h5 className="card-title">总待办事项</h5>
                <p className="card-text display-4">{stats.todoItems}</p>
              </div>
            </div>
          </div>
          
          <div className="col-md-3">
            <div className="card text-center h-100">
              <div className="card-body">
                <h5 className="card-title">测试通过率</h5>
                <p className="card-text display-4">
                  {Math.round(stats.testStats.passRate)}%
                </p>
                <span>
                  平均分: {stats.testStats.avgScore}/100
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
      
      <div className="row">
        <div className="col-md-6">
          <div className="card mb-4">
            <div className="card-header d-flex justify-content-between align-items-center">
              <h5 className="mb-0">最近活动学生</h5>
              <Link to="/students" className="btn btn-sm btn-outline-primary">
                查看全部
              </Link>
            </div>
            <div className="card-body">
              {recentStudents.length === 0 ? (
                <p className="text-center text-muted">
                  还没有学生活动记录
                </p>
              ) : (
                <table className="table table-hover">
                  <thead>
                    <tr>
                      <th>学号</th>
                      <th>姓名</th>
                      <th>状态</th>
                      <th>最后活动</th>
                      <th>操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentStudents.map(student => (
                      <tr key={student.studentId}>
                        <td>{student.studentId}</td>
                        <td>{student.name}</td>
                        <td>
                          <span className={`badge bg-${student.status === 'online' ? 'success' : 'danger'}`}>
                            {student.status === 'online' ? '在线' : '离线'}
                          </span>
                        </td>
                        <td>
                          {new Date(student.lastReportTime).toLocaleString()}
                        </td>
                        <td>
                          <Link 
                            to={`/students/${student.studentId}`} 
                            className="btn btn-sm btn-outline-primary"
                          >
                            详情
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            <div className="card-footer text-muted">
              最后刷新: {lastRefresh}
            </div>
          </div>
        </div>
        
        <div className="col-md-6">
          <div className="card mb-4">
            <div className="card-header">
              <h5 className="mb-0">使用说明</h5>
            </div>
            <div className="card-body">
              <h6>关于学生自主上报模式</h6>
              <p>
                本系统使用学生自主上报模式工作。学生的后端程序会定期向本系统发送状态更新，
                包括他们的待办事项、测试结果和API状态。
              </p>
              
              <h6>如何监控学生进度</h6>
              <ul>
                <li>学生列表页面显示所有注册的学生</li>
                <li>点击"详情"可以查看学生的完整信息</li>
                <li>学生状态基于最后上报时间(2分钟内为在线)</li>
              </ul>
              
              <h6>排行榜功能</h6>
              <p>
                排行榜根据学生的测试通过率和完成的待办事项数量进行排名，
                可以激励学生之间的良性竞争。
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;