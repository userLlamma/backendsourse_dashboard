// frontend/src/pages/Leaderboard.js
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';

const Leaderboard = () => {
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sortField, setSortField] = useState('score');
  const [sortDirection, setSortDirection] = useState('desc');
  
  const fetchLeaderboard = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/dashboard/leaderboard');
      setLeaderboard(response.data);
      setError(null);
    } catch (err) {
      setError('获取排行榜失败');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };
  
  useEffect(() => {
    fetchLeaderboard();
    
    // 设置定期刷新
    const interval = setInterval(fetchLeaderboard, 60000); // 每分钟
    
    return () => clearInterval(interval);
  }, []);
  
  // 排序功能
  const handleSort = (field) => {
    if (sortField === field) {
      // 切换排序方向
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      // 切换排序字段，默认降序
      setSortField(field);
      setSortDirection('desc');
    }
  };
  
  // 根据排序字段和方向对数据进行排序
  const sortedLeaderboard = [...leaderboard].sort((a, b) => {
    let comparison = 0;
    
    switch (sortField) {
      case 'score':
        comparison = a.score - b.score;
        break;
      case 'passRate':
        comparison = a.passRate - b.passRate;
        break;
      case 'todoCount':
        comparison = a.todoCount - b.todoCount;
        break;
      default:
        comparison = 0;
    }
    
    // 根据排序方向调整
    return sortDirection === 'asc' ? comparison : -comparison;
  });
  
  if (loading && leaderboard.length === 0) {
    return (
      <div className="d-flex justify-content-center my-5">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
        <span className="ms-2">加载排行榜数据中...</span>
      </div>
    );
  }
  
  return (
    <div className="container-fluid py-4">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h1>学生排行榜</h1>
        
        <div>
          <span className="text-muted me-2">
            {leaderboard.length} 名学生参与
          </span>
          <button 
            className="btn btn-primary" 
            onClick={fetchLeaderboard}
            disabled={loading}
          >
            {loading ? (
              <>
                <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                刷新中...
              </>
            ) : '刷新'}
          </button>
        </div>
      </div>
      
      {error && (
        <div className="alert alert-danger" role="alert">
          {error}
        </div>
      )}
      
      {leaderboard.length === 0 ? (
        <div className="alert alert-info" role="alert">
          目前还没有排行榜数据。学生需要完成测试后才会显示在排行榜中。
        </div>
      ) : (
        <div className="card">
          <div className="card-header bg-primary text-white">
            <h5 className="mb-0">API测试完成情况排行</h5>
          </div>
          <div className="card-body">
            <div className="table-responsive">
              <table className="table table-striped table-hover">
                <thead>
                  <tr>
                    <th>排名</th>
                    <th>学号</th>
                    <th>姓名</th>
                    <th className="cursor-pointer" onClick={() => handleSort('score')}>
                      分数
                      {sortField === 'score' && (
                        <i className={`bi bi-arrow-${sortDirection === 'asc' ? 'up' : 'down'} ms-1`}></i>
                      )}
                    </th>
                    <th className="cursor-pointer" onClick={() => handleSort('passRate')}>
                      通过率
                      {sortField === 'passRate' && (
                        <i className={`bi bi-arrow-${sortDirection === 'asc' ? 'up' : 'down'} ms-1`}></i>
                      )}
                    </th>
                    <th className="cursor-pointer" onClick={() => handleSort('todoCount')}>
                      待办事项数
                      {sortField === 'todoCount' && (
                        <i className={`bi bi-arrow-${sortDirection === 'asc' ? 'up' : 'down'} ms-1`}></i>
                      )}
                    </th>
                    <th>状态</th>
                    <th>详情</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedLeaderboard.map((student, index) => (
                    <tr key={student.studentId} className={index < 3 ? 'table-warning' : ''}>
                      <td>
                        <strong>#{index + 1}</strong>
                        {index < 3 && (
                          <span className="ms-2">
                            {index === 0 && '🥇'}
                            {index === 1 && '🥈'}
                            {index === 2 && '🥉'}
                          </span>
                        )}
                      </td>
                      <td>{student.studentId}</td>
                      <td>{student.name}</td>
                      <td>
                        <strong>{student.score}</strong>
                      </td>
                      <td>
                        <div className="d-flex align-items-center">
                          <span className="me-2">{Math.round(student.passRate)}%</span>
                          <div className="progress flex-grow-1" style={{ height: '8px' }}>
                            <div
                              className={`progress-bar ${student.passRate >= 80 ? 'bg-success' : 
                                student.passRate >= 60 ? 'bg-info' : 
                                student.passRate >= 40 ? 'bg-warning' : 'bg-danger'}`}
                              role="progressbar"
                              style={{ width: `${student.passRate}%` }}
                              aria-valuenow={student.passRate}
                              aria-valuemin="0"
                              aria-valuemax="100"
                            ></div>
                          </div>
                        </div>
                      </td>
                      <td>{student.todoCount}</td>
                      <td>
                        <span className={`badge bg-${student.status === 'online' ? 'success' : 'danger'}`}>
                          {student.status === 'online' ? '在线' : '离线'}
                        </span>
                      </td>
                      <td>
                        <Link 
                          to={`/students/${student.studentId}`} 
                          className="btn btn-sm btn-outline-primary"
                        >
                          查看
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="card-footer">
            <div className="row">
              <div className="col-md-6">
                <strong>评分标准:</strong> 分数基于API测试通过率和完成的待办事项数量计算
              </div>
              <div className="col-md-6 text-end">
                <span className="text-muted">
                  最后更新: {new Date().toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* 数据统计卡片 */}
      {leaderboard.length > 0 && (
        <div className="row mt-4">
          <div className="col-md-4">
            <div className="card">
              <div className="card-body">
                <h5 className="card-title">平均得分</h5>
                <p className="display-4">
                  {Math.round(leaderboard.reduce((sum, student) => sum + student.score, 0) / leaderboard.length)}
                </p>
                <p className="text-muted">满分: 100</p>
              </div>
            </div>
          </div>
          
          <div className="col-md-4">
            <div className="card">
              <div className="card-body">
                <h5 className="card-title">平均通过率</h5>
                <p className="display-4">
                  {Math.round(leaderboard.reduce((sum, student) => sum + student.passRate, 0) / leaderboard.length)}%
                </p>
                <div className="progress mt-2">
                  <div 
                    className="progress-bar bg-success" 
                    role="progressbar" 
                    style={{ width: `${leaderboard.reduce((sum, student) => sum + student.passRate, 0) / leaderboard.length}%` }}
                    aria-valuenow={leaderboard.reduce((sum, student) => sum + student.passRate, 0) / leaderboard.length}
                    aria-valuemin="0" 
                    aria-valuemax="100"
                  ></div>
                </div>
              </div>
            </div>
          </div>
          
          <div className="col-md-4">
            <div className="card">
              <div className="card-body">
                <h5 className="card-title">在线学生比例</h5>
                <p className="display-4">
                  {Math.round(leaderboard.filter(student => student.status === 'online').length / leaderboard.length * 100)}%
                </p>
                <p className="text-muted">
                  {leaderboard.filter(student => student.status === 'online').length} / {leaderboard.length} 在线
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Leaderboard;