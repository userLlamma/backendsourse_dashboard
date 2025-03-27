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
  const [gradedFilter, setGradedFilter] = useState('all');
  
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
  
  // 检查学生是否已经被评分
  const isGradedByTeacher = (student) => {
    if (!student.lastTestResults || !student.lastTestResults.tests) {
      return false;
    }
    
    // 检查是否至少有一个测试有教师评分
    return student.lastTestResults.tests.some(test => 
      test.score && test.score.gradedBy && test.score.gradedAt
    );
  };
  
  // 筛选学生
  const filteredStudents = students.filter(student => {
    // 应用搜索筛选
    const matchesSearch = student.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          student.studentId.toLowerCase().includes(searchTerm.toLowerCase());
    
    // 应用状态筛选
    const matchesStatus = statusFilter === 'all' ||
                           (statusFilter === 'online' && student.status === 'online') ||
                           (statusFilter === 'offline' && student.status !== 'online');
    
    // 应用评分筛选
    const isGraded = isGradedByTeacher(student);
    const matchesGraded = gradedFilter === 'all' ||
                          (gradedFilter === 'graded' && isGraded) ||
                          (gradedFilter === 'ungraded' && !isGraded);
    
    return matchesSearch && matchesStatus && matchesGraded;
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
            <div className="col-md-4 mb-3 mb-md-0">
              <input
                type="text"
                className="form-control"
                placeholder="搜索学生姓名或学号..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            
            <div className="col-md-3 mb-3 mb-md-0">
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
            
            <div className="col-md-3 mb-3 mb-md-0">
              <select
                className="form-select"
                value={gradedFilter}
                onChange={(e) => setGradedFilter(e.target.value)}
              >
                <option value="all">全部评分状态</option>
                <option value="graded">已评分</option>
                <option value="ungraded">未评分</option>
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
                <th>测试通过率/得分</th>
                <th>评分状态</th>
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
                        <div>
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
                        </div>
                        {/* 显示教师评分，如果有 */}
                        {isGradedByTeacher(student) && (
                          <div className="mt-1 small">
                            <strong>得分: </strong>
                            <span className="text-primary">
                              {student.lastTestResults.score || 0} / {student.lastTestResults.maxPossibleScore || 100}
                            </span>
                          </div>
                        )}
                      </>
                    ) : (
                      <span className="text-muted">未测试</span>
                    )}
                  </td>
                  <td>
                    {student.lastTestResults ? (
                      isGradedByTeacher(student) ? (
                        <span className="badge bg-success">已评分</span>
                      ) : (
                        <span className="badge bg-warning">未评分</span>
                      )
                    ) : (
                      <span className="badge bg-secondary">未测试</span>
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