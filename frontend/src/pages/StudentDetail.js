// frontend/src/pages/StudentDetail.js
import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import axios from 'axios';

const StudentDetail = () => {
  const { studentId } = useParams();
  const navigate = useNavigate();
  
  const [student, setStudent] = useState(null);
  const [todos, setTodos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('info');
  
  // 获取学生详情
  const fetchStudentDetails = async () => {
    try {
      setLoading(true);
      
      // 获取学生基本信息
      const studentRes = await axios.get(`/api/students/${studentId}`);
      setStudent(studentRes.data);
      
      // 设置todos数据，已经包含在学生数据中
      setTodos(studentRes.data.todos || []);
      
      setError(null);
    } catch (err) {
      setError('获取学生信息失败');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };
  
  useEffect(() => {
    fetchStudentDetails();
    
    // 设置定期刷新
    const interval = setInterval(fetchStudentDetails, 30000); // 每30秒
    
    return () => clearInterval(interval);
  }, [studentId]);
  
  // 发送命令到学生
  const sendCommand = async (command, params = {}) => {
    try {
      setLoading(true);
      await axios.post(`/api/students/${studentId}/command`, {
        command,
        params
      });
      
      // 显示成功消息
      alert(`命令 ${command} 已成功发送，将在学生下次报告时执行`);
      
      setError(null);
    } catch (err) {
      setError('发送命令失败');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };
  
  if (loading && !student) {
    return (
      <div className="d-flex justify-content-center my-5">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
        <span className="ms-2">加载学生信息中...</span>
      </div>
    );
  }
  
  if (error && !student) {
    return (
      <div className="container-fluid py-4">
        <div className="alert alert-danger" role="alert">
          {error}
        </div>
        <button
          className="btn btn-primary"
          onClick={() => navigate('/students')}
        >
          返回学生列表
        </button>
      </div>
    );
  }
  
  if (!student) {
    return (
      <div className="container-fluid py-4">
        <div className="alert alert-warning" role="alert">
          找不到学号为 {studentId} 的学生信息
        </div>
        <button
          className="btn btn-primary"
          onClick={() => navigate('/students')}
        >
          返回学生列表
        </button>
      </div>
    );
  }
  
  return (
    <div className="container-fluid py-4">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h1>{student.name} 的详细信息</h1>
        
        <div>
          <button
            className="btn btn-outline-primary me-2"
            onClick={fetchStudentDetails}
          >
            刷新
          </button>
          <Link to="/students" className="btn btn-outline-secondary">
            返回列表
          </Link>
        </div>
      </div>
      
      {error && (
        <div className="alert alert-danger" role="alert">
          {error}
        </div>
      )}
      
      <div className="row mb-4">
        <div className="col-md-4">
          <div className="card h-100">
            <div className="card-header">
              <h5 className="mb-0">基本信息</h5>
            </div>
            <div className="card-body">
              <ul className="list-group list-group-flush">
                <li className="list-group-item d-flex justify-content-between align-items-start">
                  <div className="ms-2 me-auto">
                    <div className="fw-bold">学号</div>
                    {student.studentId}
                  </div>
                </li>
                <li className="list-group-item d-flex justify-content-between align-items-start">
                  <div className="ms-2 me-auto">
                    <div className="fw-bold">姓名</div>
                    {student.name}
                  </div>
                </li>
                <li className="list-group-item d-flex justify-content-between align-items-start">
                  <div className="ms-2 me-auto">
                    <div className="fw-bold">IP地址</div>
                    {student.ipAddress}:{student.port}
                  </div>
                </li>
                <li className="list-group-item d-flex justify-content-between align-items-start">
                  <div className="ms-2 me-auto">
                    <div className="fw-bold">状态</div>
                  </div>
                  <span className={`badge bg-${student.status === 'online' ? 'success' : 'danger'} rounded-pill`}>
                    {student.status === 'online' ? '在线' : '离线'}
                  </span>
                </li>
                <li className="list-group-item d-flex justify-content-between align-items-start">
                  <div className="ms-2 me-auto">
                    <div className="fw-bold">最后活动时间</div>
                    {new Date(student.lastReportTime).toLocaleString()}
                  </div>
                </li>
                <li className="list-group-item d-flex justify-content-between align-items-start">
                  <div className="ms-2 me-auto">
                    <div className="fw-bold">API版本</div>
                    {student.apiVersion || '未知'}
                  </div>
                </li>
              </ul>
            </div>
            <div className="card-footer">
              <div className="d-grid gap-2">
                <button 
                  className="btn btn-warning btn-sm"
                  onClick={() => sendCommand('RUN_TEST')}
                >
                  执行测试
                </button>
              </div>
            </div>
          </div>
        </div>
        
        <div className="col-md-8">
          <div className="card h-100">
            <div className="card-header">
              <ul className="nav nav-tabs card-header-tabs">
                <li className="nav-item">
                  <button
                    className={`nav-link ${activeTab === 'info' ? 'active' : ''}`}
                    onClick={() => setActiveTab('info')}
                  >
                    概览
                  </button>
                </li>
                <li className="nav-item">
                  <button
                    className={`nav-link ${activeTab === 'todos' ? 'active' : ''}`}
                    onClick={() => setActiveTab('todos')}
                  >
                    待办事项 ({todos.length})
                  </button>
                </li>
                <li className="nav-item">
                  <button
                    className={`nav-link ${activeTab === 'tests' ? 'active' : ''}`}
                    onClick={() => setActiveTab('tests')}
                  >
                    测试结果
                  </button>
                </li>
              </ul>
            </div>
            <div className="card-body">
              {activeTab === 'info' && (
                <div>
                  <h5 className="card-title">学生状态概览</h5>
                  
                  <div className="row mb-4">
                    <div className="col-md-6">
                      <div className="card">
                        <div className="card-body text-center">
                          <h5 className="card-title">待办事项</h5>
                          <p className="display-4">{todos.length}</p>
                        </div>
                      </div>
                    </div>
                    <div className="col-md-6">
                      <div className="card">
                        <div className="card-body text-center">
                          <h5 className="card-title">测试通过率</h5>
                          {student.lastTestResults ? (
                            <>
                              <p className="display-4">
                                {Math.round((student.lastTestResults.totalPassed / 
                                  (student.lastTestResults.totalPassed + student.lastTestResults.totalFailed)) * 100)}%
                              </p>
                              <span>
                                {student.lastTestResults.totalPassed} / 
                                {student.lastTestResults.totalPassed + student.lastTestResults.totalFailed} 通过
                              </span>
                            </>
                          ) : (
                            <p className="display-4">-</p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <h6>活动时间线</h6>
                  <ul className="list-group">
                    <li className="list-group-item">
                      最后报告时间: {new Date(student.lastReportTime).toLocaleString()}
                    </li>
                    <li className="list-group-item">
                      首次注册时间: {new Date(student.createdAt).toLocaleString()}
                    </li>
                    {student.lastTestResults && (
                      <li className="list-group-item">
                        最后测试时间: {new Date(student.lastTestResults.timestamp || student.updatedAt).toLocaleString()}
                      </li>
                    )}
                  </ul>
                </div>
              )}
              
              {activeTab === 'todos' && (
                <div>
                  <h5 className="card-title">待办事项列表</h5>
                  
                  {todos.length === 0 ? (
                    <div className="alert alert-info">
                      该学生尚未创建任何待办事项
                    </div>
                  ) : (
                    <div className="table-responsive">
                      <table className="table table-striped">
                        <thead>
                          <tr>
                            <th>ID</th>
                            <th>标题</th>
                            <th>状态</th>
                            <th>创建时间</th>
                          </tr>
                        </thead>
                        <tbody>
                          {todos.map(todo => (
                            <tr key={todo.id}>
                              <td>{todo.id}</td>
                              <td>{todo.title}</td>
                              <td>
                                {todo.completed !== undefined && (
                                  <span className={`badge bg-${todo.completed ? 'success' : 'secondary'}`}>
                                    {todo.completed ? '已完成' : '未完成'}
                                  </span>
                                )}
                              </td>
                              <td>
                                {todo.created_at ? new Date(todo.created_at).toLocaleString() : '未知'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
              
              {activeTab === 'tests' && (
                <div>
                  <h5 className="card-title">API测试结果</h5>
                  
                  {!student.lastTestResults ? (
                    <div className="alert alert-info">
                      该学生尚未进行API测试
                    </div>
                  ) : (
                    <div>
                      <div className="mb-3">
                        <strong>总得分:</strong> {student.lastTestResults.score} 分
                      </div>
                      
                      <div className="mb-3">
                        <strong>通过率:</strong>
                        <div className="progress mt-2">
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
                          >
                            {Math.round((student.lastTestResults.totalPassed / 
                              (student.lastTestResults.totalPassed + student.lastTestResults.totalFailed)) * 100)}%
                          </div>
                        </div>
                      </div>
                      
                      <div className="table-responsive">
                        <table className="table table-striped">
                          <thead>
                            <tr>
                              <th>测试名称</th>
                              <th>状态</th>
                              <th>详情</th>
                            </tr>
                          </thead>
                          <tbody>
                            {student.lastTestResults.tests.map((test, index) => (
                              <tr key={index}>
                                <td>{test.name}</td>
                                <td>
                                  <span className={`badge bg-${test.passed ? 'success' : 'danger'}`}>
                                    {test.passed ? '通过' : '失败'}
                                  </span>
                                </td>
                                <td>
                                  {test.error || (test.passed ? '测试成功' : '测试失败')}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StudentDetail;