// frontend/src/pages/StudentDetail.js
import React, { useState, useEffect, useRef  } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import ModelStatusPanel from '../components/ModelStatusPanel';

import { useContext } from 'react';
import { AuthContext } from '../contexts/AuthContext';   // RBAC


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

  const [autoGradingEnabled, setAutoGradingEnabled] = useState(false);
  const [autoGradingInProgress, setAutoGradingInProgress] = useState(false);
  const [autoGradingStatus, setAutoGradingStatus] = useState(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const { currentUser } = useContext(AuthContext);

  // 修改密码的状态
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [changePasswordError, setChangePasswordError] = useState('');
  const [changePasswordSuccess, setChangePasswordSuccess] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  // 添加防重复请求控制
  const [lastRequestTime, setLastRequestTime] = useState(0);
  const isRequestInProgressRef = useRef(false);
  
  // 获取学生详情
  const fetchStudentDetails = async (force = false) => {
    // 防止重复请求
    const now = Date.now();
    if (!force && (isRequestInProgressRef.current || now - lastRequestTime < 5000)) {
      console.log('跳过重复请求 - 间隔过短或请求已在进行中');
      return;
    }
    
    try {
      isRequestInProgressRef.current = true;
      setLastRequestTime(now);
      setLoading(true);
      
      // 获取学生基本信息
      const studentRes = await axios.get(`/api/students/${studentId}`);
      setStudent(studentRes.data);
      setTodos(studentRes.data.todos || []);
      setError(null);
    } catch (err) {
      setError('获取学生信息失败');
      console.error(err);
    } finally {
      isRequestInProgressRef.current = false;
      setLoading(false);
    }
  };
  
  // 检查自动评分系统状态（只需执行一次）
  useEffect(() => {
    checkAutoGradingStatus();
  }, []);

  // 获取学生详情并设置定期刷新
  useEffect(() => {
    fetchStudentDetails();
    
    // 设置定期刷新
    const interval = setInterval(fetchStudentDetails, 30000); // 每30秒
    
    return () => clearInterval(interval);
  }, [studentId]); // 添加 fetchStudentDetails 到依赖数组

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
    // 创建一个完整的测试对象，填充缺失的字段
    const completeTest = {
      name: test.name || '未命名测试',
      endpoint: test.endpoint || '未知端点',
      method: test.method || 'GET',
      passed: test.passed || false,
      response: test.response || null,
      error: test.error || '无错误信息',
      score: test.score || { value: 0, maxValue: 10 }
    };
    
    setSelectedTest(completeTest);
    setSelectedTestScore(completeTest.score.value || 0);
    setSelectedTestComment(completeTest.score.comments || '');
  };

  // 获取自动评分
  const getAutoScore = async (test) => {
    if (!test || !test.response) {
      alert('无法自动评分: 测试没有响应数据');
      return;
    }
    
    try {
      setAutoGradingInProgress(true);
      
      // 构建测试用例信息
      const testCase = {
        name: test.name,
        endpoint: test.endpoint,
        method: test.method,
        status: test.status,
        expectedStatus: test.expectedStatus
      };
      
      // 调用自动评分API
      const response = await axios.post('/api/auto-grading/score', {
        studentResponse: test.response,
        testCase,
        studentId
      });
      
      // 更新评分
      setSelectedTestScore(response.data.score);
      setSelectedTestComment(`自动评分: ${response.data.score}/10\n解释: ${response.data.explanation || '根据API响应结构和内容评估'}`);
      
      // 保存自动评分结果状态
      setAutoGradingStatus({
        score: response.data.score,
        confidence: response.data.confidence,
        explanation: response.data.explanation,
        details: response.data.details
      });
      
      // 显示成功消息
      alert(`自动评分完成: ${response.data.score}/10`);
    } catch (err) {
      console.error('自动评分失败:', err);
      alert(`自动评分失败: ${err.response?.data?.error || err.message}`);
    } finally {
      setAutoGradingInProgress(false);
    }
  };

  // 设置参考解决方案
  const setAsReferenceSolution = async (test) => {
    if (!test || !test.response) {
      alert('无法设置参考解决方案: 测试没有响应数据');
      return;
    }
    
    // 确认设置
    if (!window.confirm(`确定要将该测试响应设置为"${test.name}"的参考解决方案吗？其他教师将使用此响应作为评分标准。`)) {
      return;
    }
    
    try {
      // 构建测试信息
      const testInfo = {
        name: test.name,
        endpoint: test.endpoint,
        method: test.method,
        id: Date.now().toString()
      };
      
      // 调用API
      const response = await axios.post('/api/auto-grading/reference-solution', {
        studentId,
        testInfo
      });
      
      // 显示成功消息
      alert(`参考解决方案设置成功!\n现在"${test.name}"将使用此学生的响应作为评分标准。`);
    } catch (err) {
      console.error('设置参考解决方案失败:', err);
      alert(`设置参考解决方案失败: ${err.response?.data?.error || err.message}`);
    }
  };

  // 向自动评分学习
  const learnFromTestScore = async () => {
    if (!selectedTest || !selectedTest.response) {
      alert('无法学习: 测试没有响应数据');
      return;
    }
    
    // 确认学习
    if (!window.confirm(`确定要让自动评分系统学习你对此测试的评分吗？系统将根据你的评分${selectedTestScore}/10提高对类似API响应的评分准确性。`)) {
      return;
    }
    
    try {
      setAutoGradingInProgress(true);
      console.log('开始学习过程...');
      
      // 首先获取参考解决方案
      console.log('获取自动评分状态...');
      const res = await axios.get('/api/auto-grading/status');
      console.log('获取参考解决方案结果:', res.data);
      const referenceSolutions = res.data.referenceSolutions || [];
      
      // 查找当前测试的参考解决方案
      console.log(`为测试 ${selectedTest.name} 查找参考解决方案...`);
      const referenceSolution = referenceSolutions.find(
        sol => sol.testName === selectedTest.name && 
              sol.endpoint === selectedTest.endpoint
      );
      
      if (!referenceSolution) {
        alert('无法学习: 未找到此测试的参考解决方案。请先设置参考解决方案。');
        setAutoGradingInProgress(false);
        return;
      }
      
      console.log('找到参考解决方案:', referenceSolution);
      
      // 获取参考学生的测试响应
      console.log(`获取参考学生 ${referenceSolution.studentId} 数据...`);
      const refStudentRes = await axios.get(`/api/students/${referenceSolution.studentId}`);
      console.log('获取参考学生数据结果:', refStudentRes.data);
      const refStudent = refStudentRes.data;
      
      if (!refStudent || !refStudent.lastTestResults || !refStudent.lastTestResults.tests) {
        alert('无法学习: 参考解决方案数据不可用');
        setAutoGradingInProgress(false);
        return;
      }
      
      // 查找参考测试
      console.log('查找参考测试数据...');
      const refTest = refStudent.lastTestResults.tests.find(
        test => test.name === selectedTest.name && test.endpoint === selectedTest.endpoint
      );
      
      if (!refTest || !refTest.response) {
        alert('无法学习: 参考解决方案响应数据不可用');
        setAutoGradingInProgress(false);
        return;
      }
      
      console.log('找到参考测试数据');
      
      // 构建测试用例信息
      const testCase = {
        name: selectedTest.name,
        endpoint: selectedTest.endpoint,
        method: selectedTest.method
      };
      
      // 调用学习API
      console.log('调用学习API...');
      console.log('学习数据:', {
        studentResponse: '(object)',
        referenceResponse: '(object)',
        teacherScore: selectedTestScore,
        testCase
      });
      
      const learnRes = await axios.post('/api/auto-grading/learn', {
        studentResponse: selectedTest.response,
        referenceResponse: refTest.response,
        teacherScore: selectedTestScore,
        testCase
      },{
        timeout: 10000 // 10秒超时
      });
      
      console.log('学习API响应:', learnRes.data);
      
      // 显示成功消息
      alert(
        learnRes.data.message + 
        `\n当前样本数: ${learnRes.data.modelStatus.sampleCount}` +
        (learnRes.data.modelStatus.scoreDifference ? 
          `\n评分差异: ${learnRes.data.modelStatus.scoreDifference.toFixed(1)}分` : '')
      );
    } catch (err) {
      console.error('学习失败:', err);
      // 检查错误类型
      if (err.response) {
        // 服务器响应错误
        console.error('响应状态:', err.response.status);
        console.error('响应数据:', err.response.data);
      } else if (err.request) {
        // 请求已发送但没有收到响应
        console.error('请求已发送但没有收到响应');
      } else {
        // 请求设置有问题
        console.error('请求设置问题:', err.message);
      }
      
      alert(`学习失败: ${err.response?.data?.error || err.message}`);
    } finally {
      console.log('学习过程结束');
      setAutoGradingInProgress(false);
    }
  };

  // 检查自动评分系统状态
  const checkAutoGradingStatus = async () => {
    try {
      const response = await axios.get('/api/auto-grading/status');
      setAutoGradingEnabled(response.data.enabled);
    } catch (err) {
      console.error('获取自动评分状态失败:', err);
      setAutoGradingEnabled(false);
    }
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
      
      const response = await axios.post(`/api/students/${studentId}/update-test-scores`, {
        tests: updatedTests,
        totalScore,
        maxPossibleScore
      });
      
      // 确认更新成功后，直接获取最新数据而不是尝试本地更新
      fetchStudentDetails(true); // 传递true参数强制刷新
      
      // 显示成功消息，包括更新后的测试统计
      const passRate = response.data.testStats ? response.data.testStats.passRate.toFixed(1) + '%' : '计算中';
      
      alert(`评分已保存成功！\n总分: ${response.data.score}/${response.data.maxPossibleScore}\n通过率: ${passRate}`);
      
      setError(null);
    } catch (err) {
      setError('保存评分失败');
      console.error(err);
      alert('保存评分失败: ' + (err.response?.data?.error || '未知错误'));
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
  
  // 处理密码修改表单提交
  const handleChangePasswordSubmit = async (e) => {
    e.preventDefault();
    setChangePasswordError('');
    setChangePasswordSuccess('');
  
    // Client-side validation
    if (!currentPassword || !newPassword || !confirmNewPassword) {
      setChangePasswordError('请填写所有字段');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setChangePasswordError('两次输入的新密码不一致');
      return;
    }
  
    try {
      setIsChangingPassword(true);
      const token = localStorage.getItem('authToken'); // Get token from storage
      const response = await axios.post('/api/student-auth/change-password', {
        currentPassword,
        newPassword,
      }, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
  
      if (response.status === 200) {
        setChangePasswordSuccess('密码修改成功');
        // Reset form fields
        setCurrentPassword('');
        setNewPassword('');
        setConfirmNewPassword('');
        // Close the modal
        setShowChangePasswordModal(false);
      } else {
        setChangePasswordError(response.data.error || '修改密码失败');
      }
    } catch (error) {
      console.error('Error changing password:', error);
      setChangePasswordError(error.response?.data?.error || '修改密码失败');
    } finally {
      setIsChangingPassword(false);
    }
  };

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
                {/* Change Password button here */}
                {currentUser && currentUser.isStudent && (
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => setShowChangePasswordModal(true)}
                  >
                    修改密码
                  </button>
                )}
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
                    <div className="card">
                      <div className="card-body">
                        <div className="row mb-3">
                          <div className="col-md-6">
                            <h6>
                              <span className="badge bg-primary me-2">{todos.length}</span>
                              总待办事项
                            </h6>
                          </div>
                          <div className="col-md-6 text-end">
                            <h6>
                              <span className="badge bg-success me-2">
                                {todos.filter(todo => todo.completed).length}
                              </span>
                              已完成
                            </h6>
                          </div>
                        </div>
                        
                        <div className="progress mb-3">
                          <div 
                            className="progress-bar bg-success" 
                            role="progressbar" 
                            style={{ 
                              width: `${todos.length ? (todos.filter(todo => todo.completed).length / todos.length) * 100 : 0}%` 
                            }}
                            aria-valuenow={todos.length ? (todos.filter(todo => todo.completed).length / todos.length) * 100 : 0}
                            aria-valuemin="0" 
                            aria-valuemax="100"
                          >
                            {Math.round(todos.length ? (todos.filter(todo => todo.completed).length / todos.length) * 100 : 0)}%
                          </div>
                        </div>
                        
                        <div className="table-responsive">
                          <table className="table table-striped">
                            <thead>
                              <tr>
                                <th style={{ width: '10%' }}>ID</th>
                                <th style={{ width: '50%' }}>标题</th>
                                <th style={{ width: '15%' }}>状态</th>
                                <th style={{ width: '25%' }}>创建时间</th>
                              </tr>
                            </thead>
                            <tbody>
                              {todos.map(todo => (
                                <tr key={todo.id}>
                                  <td>{todo.id}</td>
                                  <td>{todo.title}</td>
                                  <td>
                                    <span className={`badge ${todo.completed ? 'bg-success' : 'bg-warning'}`}>
                                      {todo.completed ? '已完成' : '进行中'}
                                    </span>
                                  </td>
                                  <td>
                                    {todo.created_at ? new Date(todo.created_at).toLocaleString() : '未知'}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {/* 可视化部分 - 待办事项状态分布 */}
                  {todos.length > 0 && (
                    <div className="card mt-3">
                      <div className="card-header">
                        <h6 className="mb-0">待办事项数据可视化</h6>
                      </div>
                      <div className="card-body">
                        <div className="row">
                          <div className="col-md-6">
                            <h6 className="text-center mb-3">完成状态分布</h6>
                            <div className="d-flex justify-content-center">
                              <div className="position-relative" style={{ width: '150px', height: '150px' }}>
                                {/* 简易饼图 */}
                                <div className="position-absolute top-0 start-0 w-100 h-100">
                                  <svg viewBox="0 0 100 100" style={{ transform: 'rotate(-90deg)' }}>
                                    {/* 已完成部分 */}
                                    <circle
                                      cx="50"
                                      cy="50"
                                      r="40"
                                      fill="transparent"
                                      stroke="#28a745"
                                      strokeWidth="20"
                                      strokeDasharray={`${todos.filter(todo => todo.completed).length / todos.length * 251.2} 251.2`}
                                    />
                                    {/* 未完成部分 */}
                                    <circle
                                      cx="50"
                                      cy="50"
                                      r="40"
                                      fill="transparent"
                                      stroke="#ffc107"
                                      strokeWidth="20"
                                      strokeDasharray={`${todos.filter(todo => !todo.completed).length / todos.length * 251.2} 251.2`}
                                      strokeDashoffset={`-${todos.filter(todo => todo.completed).length / todos.length * 251.2}`}
                                    />
                                  </svg>
                                </div>
                                {/* 中心文字 */}
                                <div className="position-absolute top-50 start-50 translate-middle text-center">
                                  <h3 className="mb-0">{Math.round((todos.filter(todo => todo.completed).length / todos.length) * 100)}%</h3>
                                  <small>完成率</small>
                                </div>
                              </div>
                            </div>
                            <div className="d-flex justify-content-center mt-3">
                              <div className="d-flex align-items-center me-3">
                                <div className="badge bg-success me-1" style={{ width: '15px', height: '15px' }}></div>
                                <span>已完成 ({todos.filter(todo => todo.completed).length})</span>
                              </div>
                              <div className="d-flex align-items-center">
                                <div className="badge bg-warning me-1" style={{ width: '15px', height: '15px' }}></div>
                                <span>进行中 ({todos.filter(todo => !todo.completed).length})</span>
                              </div>
                            </div>
                          </div>
                          <div className="col-md-6">
                            <h6 className="text-center mb-3">最近创建的待办事项</h6>
                            <ul className="list-group">
                              {[...todos]
                                .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
                                .slice(0, 5)
                                .map(todo => (
                                  <li key={todo.id} className="list-group-item d-flex justify-content-between align-items-center">
                                    <div className="text-truncate" style={{ maxWidth: '200px' }}>
                                      {todo.title}
                                    </div>
                                    <span className={`badge ${todo.completed ? 'bg-success' : 'bg-warning'}`}>
                                      {todo.completed ? '已完成' : '进行中'}
                                    </span>
                                  </li>
                                ))}
                            </ul>
                          </div>
                        </div>
                      </div>
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
                        <h5 className="modal-title">{selectedTest.name || '测试详情'}</h5>
                        <button type="button" className="btn-close" onClick={() => setSelectedTest(null)}></button>
                      </div>
                      <div className="modal-body">
                        <h6>测试信息</h6>
                        <div className="mb-3">
                          <div><strong>端点:</strong> <code>{selectedTest.endpoint || '未知'}</code></div>
                          <div><strong>请求方法:</strong> <code>{selectedTest.method || '未知'}</code></div>
                        </div>
                        
                        <h6>测试状态</h6>
                        <div className="mb-3">
                          <span className={`badge bg-${selectedTest.passed ? 'success' : 'danger'}`}>
                            {selectedTest.passed ? '通过' : '失败'}
                          </span>
                          {selectedTest.error && selectedTest.error !== '无错误信息' && (
                            <div className="alert alert-danger mt-2">
                              错误: {selectedTest.error}
                            </div>
                          )}
                        </div>
                        
                        <h6>API响应数据</h6>
                        <div className="bg-light p-3 rounded mb-3" style={{ maxHeight: '300px', overflow: 'auto' }}>
                          {selectedTest.response ? (
                            typeof selectedTest.response === 'object' ? (
                              <pre>{JSON.stringify(selectedTest.response, null, 2)}</pre>
                            ) : (
                              <pre>{String(selectedTest.response)}</pre>
                            )
                          ) : (
                            <div className="text-muted">无响应数据</div>
                          )}
                        </div>
                        
                        <div className="row">
                          <div className="col-md-6">
                            <h6>手动评分</h6>
                            <div className="mb-3">
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
                            
                            <div className="mb-3">
                              <button
                                type="button"
                                className="btn btn-primary w-100"
                                onClick={saveSelectedTestScore}
                              >
                                保存评分
                              </button>
                            </div>
                          </div>
                          
                          <div className="col-md-6">
                            {(!student || !currentUser?.isStudent) && (
                              <div>
                                <h6>自动评分</h6>
                                <div className="mb-3">
                                  <button
                                    type="button"
                                    className="btn btn-success w-100 mb-2"
                                    onClick={() => getAutoScore(selectedTest)}
                                    disabled={autoGradingInProgress || !selectedTest.response}
                                  >
                                    {autoGradingInProgress ? (
                                      <span>
                                        <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                                        评分中...
                                      </span>
                                    ) : '自动评分'}
                                  </button>
                                  
                                  <button
                                    type="button"
                                    className="btn btn-outline-primary w-100 mb-2"
                                    onClick={learnFromTestScore}
                                    disabled={autoGradingInProgress}
                                  >
                                    学习此评分
                                  </button>
                                  
                                  <button
                                    type="button"
                                    className="btn btn-outline-warning w-100"
                                    onClick={() => setAsReferenceSolution(selectedTest)}
                                    disabled={autoGradingInProgress || !selectedTest.response}
                                  >
                                    设为参考解决方案
                                  </button>
                                </div>
                                {activeTab === 'tests' && (
                                  <div className="mb-4">
                                    <button 
                                      className={`btn ${autoGradingEnabled ? 'btn-danger' : 'btn-success'}`}
                                      onClick={async () => {
                                        try {
                                          const newStatus = !autoGradingEnabled;
                                          await axios.put('/api/auto-grading/config', { enabled: newStatus });
                                          setAutoGradingEnabled(newStatus);
                                          alert(`自动评分系统已${newStatus ? '启用' : '禁用'}`);
                                        } catch (err) {
                                          alert('更新失败: ' + (err.response?.data?.error || '未知错误'));
                                        }
                                      }}
                                    >
                                      {autoGradingEnabled ? '禁用' : '启用'}自动评分系统
                                    </button>
                                  </div>
                                )}
                                {/* 自动评分结果 */}
                                {activeTab === 'tests' && (
                                <div className="mt-4 mb-2">
                                      <ModelStatusPanel 
                                        refreshTrigger={refreshTrigger} 
                                        autoGradingEnabled={autoGradingEnabled}
                                        onStatusChange={(enabled) => setAutoGradingEnabled(enabled)}
                                      />
                                </div>
                              )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="modal-footer">
                        <button type="button" className="btn btn-secondary" onClick={() => setSelectedTest(null)}>关闭</button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

            </div>
          </div>
        </div>
      </div>

      {/* Change Password Modal */}
      {showChangePasswordModal && (
        <div className="modal fade show" style={{ display: 'block' }} tabIndex="-1">
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">修改密码</h5>
                <button type="button" className="btn-close" onClick={() => setShowChangePasswordModal(false)}></button>
              </div>
              <div className="modal-body">
                {changePasswordError && (
                  <div className="alert alert-danger" role="alert">
                    {changePasswordError}
                  </div>
                )}
                {changePasswordSuccess && (
                  <div className="alert alert-success" role="alert">
                    {changePasswordSuccess}
                  </div>
                )}
                <form onSubmit={handleChangePasswordSubmit}>
                  <div className="mb-3">
                    <label htmlFor="currentPassword" className="form-label">当前密码</label>
                    <input
                      type="password"
                      className="form-control"
                      id="currentPassword"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      required
                    />
                  </div>
                  <div className="mb-3">
                    <label htmlFor="newPassword" className="form-label">新密码</label>
                    <input
                      type="password"
                      className="form-control"
                      id="newPassword"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      required
                    />
                  </div>
                  <div className="mb-3">
                    <label htmlFor="confirmNewPassword" className="form-label">确认新密码</label>
                    <input
                      type="password"
                      className="form-control"
                      id="confirmNewPassword"
                      value={confirmNewPassword}
                      onChange={(e) => setConfirmNewPassword(e.target.value)}
                      required
                    />
                  </div>
                  <div className="d-flex justify-content-end">
                    <button type="button" className="btn btn-secondary me-2" onClick={() => setShowChangePasswordModal(false)}>取消</button>
                    <button type="submit" className="btn btn-primary" disabled={isChangingPassword}>
                      {isChangingPassword ? (
                        <>
                          <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                          &nbsp;修改中...
                        </>
                      ) : '修改密码'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StudentDetail;