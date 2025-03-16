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

  const [selectedTest, setSelectedTest] = useState(null);
  const [selectedTestScore, setSelectedTestScore] = useState(0);
  const [selectedTestComment, setSelectedTestComment] = useState('');
  const [updatedTests, setUpdatedTests] = useState([]);
  
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

  // 初始化更新状态
  useEffect(() => {
    if (student && student.lastTestResults && student.lastTestResults.tests) {
      setUpdatedTests([...student.lastTestResults.tests]);
    }
  }, [student]);

  // 处理评分变更
  const handleScoreChange = (index, value) => {
    const newTests = [...updatedTests];
    if (!newTests[index].score) {
      newTests[index].score = { value: 0, maxValue: 10 };
    }
    newTests[index].score.value = value;
    setUpdatedTests(newTests);
  };

  // 打开测试详情
  const openTestDetails = (test) => {
    setSelectedTest(test);
    setSelectedTestScore(test.score?.value || 0);
    setSelectedTestComment(test.score?.comments || '');
  };

  // 保存选中测试的评分
  const saveSelectedTestScore = () => {
    const newTests = [...updatedTests];
    const index = newTests.findIndex(t => t.name === selectedTest.name);
    
    if (index !== -1) {
      if (!newTests[index].score) {
        newTests[index].score = { maxValue: 10 };
      }
      newTests[index].score.value = selectedTestScore;
      newTests[index].score.comments = selectedTestComment;
      setUpdatedTests(newTests);
    }
    
    setSelectedTest(null);
  };

  // 保存所有评分
  const saveTestScores = async () => {
    try {
      setLoading(true);
      
      // 计算总分
      const totalScore = updatedTests.reduce((sum, test) => sum + (test.score?.value || 0), 0);
      const maxPossibleScore = updatedTests.reduce((sum, test) => sum + (test.score?.maxValue || 10), 0);
      
      await axios.post(`/api/students/${studentId}/update-test-scores`, {
        tests: updatedTests,
        totalScore,
        maxPossibleScore
      });
      
      fetchStudentDetails(); // 刷新数据
      alert('评分已保存');
    } catch (err) {
      setError('保存评分失败');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };
  
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
                    onClick={() => {
                      console.log("Setting active tab to tests");
                      setActiveTab('tests');
                    }}
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
                  
                  {console.log('Student in tests tab:', student)}
                  {console.log('lastTestResults:', student?.lastTestResults)}
                  
                  {!student.lastTestResults ? (
                    <div className="alert alert-info">
                      该学生尚未进行API测试
                    </div>
                  ) : !student.lastTestResults.tests || student.lastTestResults.tests.length === 0 ? (
                    <div className="alert alert-warning">
                      测试结果存在但没有测试项目数据
                    </div>
                  ) : (
                    <div>
                      <div className="mb-3">
                        <strong>总得分:</strong> {student.lastTestResults.score || 0} / {student.lastTestResults.maxPossibleScore || 0} 分
                        <div className="progress mt-2">
                          <div
                            className="progress-bar"
                            role="progressbar"
                            style={{ 
                              width: `${student.lastTestResults.maxPossibleScore ? 
                                (student.lastTestResults.score / student.lastTestResults.maxPossibleScore) * 100 : 0}%` 
                            }}
                            aria-valuenow={student.lastTestResults.maxPossibleScore ? 
                              (student.lastTestResults.score / student.lastTestResults.maxPossibleScore) * 100 : 0}
                            aria-valuemin="0"
                            aria-valuemax="100"
                          >
                            {student.lastTestResults.maxPossibleScore ? 
                              Math.round((student.lastTestResults.score / student.lastTestResults.maxPossibleScore) * 100) : 0}%
                          </div>
                        </div>
                      </div>
                      
                      <div className="table-responsive">
                        <table className="table table-striped">
                          <thead>
                            <tr>
                              <th>测试名称</th>
                              <th>端点</th>
                              <th>评分</th>
                              <th>详情</th>
                            </tr>
                          </thead>
                          <tbody>
                            {student.lastTestResults.tests.map((test, index) => (
                              <tr key={index}>
                                <td>{test.name}</td>
                                <td>
                                  <code>{test.method} {test.endpoint}</code>
                                </td>
                                <td>
                                  <div className="d-flex align-items-center">
                                    <input 
                                      type="number" 
                                      className="form-control form-control-sm me-2" 
                                      style={{ width: "60px" }}
                                      min="0" 
                                      max={test.score?.maxValue || 10} 
                                      value={test.score?.value || 0}
                                      onChange={(e) => handleScoreChange(index, parseInt(e.target.value))}
                                    />
                                    <span>/ {test.score?.maxValue || 10}</span>
                                  </div>
                                </td>
                                <td>
                                  <button 
                                    className="btn btn-sm btn-outline-primary"
                                    onClick={() => openTestDetails(test)}
                                  >
                                    查看响应
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      
                      <div className="d-flex justify-content-end mt-3">
                        <button 
                          className="btn btn-primary"
                          onClick={saveTestScores}
                        >
                          保存评分
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* 测试详情模态框 */}
              {selectedTest && (
                <div className="modal fade show" style={{ display: 'block' }} tabIndex="-1">
                  <div className="modal-dialog modal-lg">
                    <div className="modal-content">
                      <div className="modal-header">
                        <h5 className="modal-title">{selectedTest.name} 详细信息</h5>
                        <button type="button" className="btn-close" onClick={() => setSelectedTest(null)}></button>
                      </div>
                      <div className="modal-body">
                        <h6>请求信息</h6>
                        <div className="mb-3">
                          <code>{selectedTest.method} {selectedTest.endpoint}</code>
                        </div>
                        
                        <h6>API响应</h6>
                        <div className="bg-light p-3 rounded mb-3" style={{ maxHeight: '300px', overflow: 'auto' }}>
                          <pre>{JSON.stringify(selectedTest.response, null, 2)}</pre>
                        </div>
                        
                        <h6>评分</h6>
                        <div className="row mb-3">
                          <div className="col-md-6">
                            <div className="input-group">
                              <input 
                                type="number" 
                                className="form-control" 
                                min="0" 
                                max={selectedTest.score?.maxValue || 10}
                                value={selectedTestScore}
                                onChange={(e) => setSelectedTestScore(parseInt(e.target.value))}
                              />
                              <span className="input-group-text">/ {selectedTest.score?.maxValue || 10}</span>
                            </div>
                          </div>
                        </div>
                        
                        <div className="mb-3">
                          <label className="form-label">评分备注</label>
                          <textarea 
                            className="form-control"
                            rows="3"
                            value={selectedTestComment}
                            onChange={(e) => setSelectedTestComment(e.target.value)}
                            placeholder="输入评分备注（可选）"
                          ></textarea>
                        </div>
                      </div>
                      <div className="modal-footer">
                        <button type="button" className="btn btn-secondary" onClick={() => setSelectedTest(null)}>关闭</button>
                        <button 
                          type="button" 
                          className="btn btn-primary"
                          onClick={saveSelectedTestScore}
                        >
                          保存评分
                        </button>
                      </div>
                    </div>
                  </div>
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