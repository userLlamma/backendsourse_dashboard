// frontend/src/pages/StudentList.js
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';

const StudentList = () => {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  
  // 获取学生列表
  const fetchStudents = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/students');
      setStudents(response.data);
      setError(null);
    } catch (err) {
      setError('获取学生列表失败');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };
  
  useEffect(() => {
    fetchStudents();
    
    // 设置定期刷新
    const interval = setInterval(fetchStudents, 30000); // 每30秒
    
    return () => clearInterval(interval);
  }, []);
  
  // 筛选学生
  const filteredStudents = students.filter(student => {
    // 应用搜索筛选
    const matchesSearch = student.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          student.studentId.toLowerCase().includes(searchTerm.toLowerCase());
    
    // 应用状态筛选
    const matchesStatus = statusFilter === 'all' ||
                           (statusFilter === 'online' && student.status === 'online') ||
                           (statusFilter === 'offline' && student.status !== 'online');
    
    return matchesSearch && matchesStatus;
  });
  
  if (loading && students.length === 0) {
    return (
      <div className="d-flex justify-content-center my-5">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
        <span className="ms-2">加载学生数据中...</span>
      </div>
    );
  }
  
  return (
    <div className="container-fluid py-4">
      <h1 className="mb-4">学生列表</h1>
      
      {error && (
        <div className="alert alert-danger" role="alert">
          {error}
        </div>
      )}
      
      <div className="card mb-4">
        <div className="card-body">
          <div className="row">
            <div className="col-md-6 mb-3 mb-md-0">
              <input
                type="text"
                className="form-control"
                placeholder="搜索学生姓名或学号..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            
            <div className="col-md-4 mb-3 mb-md-0">
              <select
                className="form-select"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="all">全部状态</option>
                <option value="online">在线</option>
                <option value="offline">离线</option>
              </select>
            </div>
            
            <div className="col-md-2">
              <button
                className="btn btn-primary w-100"
                onClick={fetchStudents}
              >
                刷新
              </button>
            </div>
          </div>
        </div>
      </div>
      
      {students.length === 0 ? (
        <div className="alert alert-info" role="alert">
          尚未有学生注册。学生需要启动他们的后端服务并配置环境变量以连接到系统。
        </div>
      ) : filteredStudents.length === 0 ? (
        <div className="alert alert-warning" role="alert">
          没有匹配的学生。请尝试不同的搜索条件。
        </div>
      ) : (
        <div className="table-responsive">
          <table className="table table-striped table-hover">
            <thead>
              <tr>
                <th>学号</th>
                <th>姓名</th>
                <th>状态</th>
                <th>待办事项</th>
                <th>最后活动</th>
                <th>测试通过率</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {filteredStudents.map(student => (
                <tr key={student.studentId}>
                  <td>{student.studentId}</td>
                  <td>{student.name}</td>
                  <td>
                    <span className={`badge bg-${student.status === 'online' ? 'success' : 'danger'}`}>
                      {student.status === 'online' ? '在线' : '离线'}
                    </span>
                  </td>
                  <td>{student.todoCount || 0}</td>
                  <td>
                    {new Date(student.lastReportTime).toLocaleString()}
                  </td>
                  <td>
                    {student.lastTestResults ? (
                      <>
                        {student.lastTestResults.totalPassed} / 
                        {student.lastTestResults.totalPassed + student.lastTestResults.totalFailed}
                        <div className="progress mt-1" style={{ height: '5px' }}>
                          <div
                            className="progress-bar"
                            role="progressbar"
                            style={{ 
                              width: `${(student.lastTestResults.totalPassed / 
                                (student.lastTestResults.totalPassed + student.lastTestResults.totalFailed)) * 100}%` 
                            }}
                            aria-valuenow={(student.lastTestResults.totalPassed / 
                              (student.lastTestResults.totalPassed + student.lastTestResults.totalFailed)) * 100}
                            aria-valuemin="0"
                            aria-valuemax="100"
                          ></div>
                        </div>
                      </>
                    ) : (
                      <span className="text-muted">未测试</span>
                    )}
                  </td>
                  <td>
                    <Link 
                      to={`/students/${student.studentId}`} 
                      className="btn btn-sm btn-primary"
                    >
                      详情
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default StudentList;