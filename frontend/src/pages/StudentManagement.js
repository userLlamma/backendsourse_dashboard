// frontend/src/pages/StudentManagement.js
import React, { useState, useEffect, useContext } from 'react';
import axios from 'axios';
import { AuthContext } from '../contexts/AuthContext';

const StudentManagement = () => {
  const { currentUser } = useContext(AuthContext);
  const isAdmin = currentUser && currentUser.role === 'admin';
  
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // 表单状态
  const [formMode, setFormMode] = useState('create'); // 'create' or 'reset'
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [newStudentId, setNewStudentId] = useState('');
  const [newStudentName, setNewStudentName] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showForm, setShowForm] = useState(false);
  
  // 批量导入
  const [batchData, setBatchData] = useState('');
  const [showBatchForm, setShowBatchForm] = useState(false);
  const [batchResults, setBatchResults] = useState(null);
  
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
  }, []);
  
  // 创建新学生
  const handleCreateStudent = async (e) => {
    e.preventDefault();
    
    try {
      setLoading(true);
      await axios.post('/api/student-management/create', {
        studentId: newStudentId,
        name: newStudentName,
        initialPassword: newPassword || newStudentId // 如未提供密码，使用学号作为初始密码
      });
      
      // 重置表单
      setNewStudentId('');
      setNewStudentName('');
      setNewPassword('');
      setShowForm(false);
      
      // 刷新学生列表
      fetchStudents();
      
      alert('学生创建成功');
    } catch (err) {
      setError(err.response?.data?.error || '创建学生失败');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };
  
  // 重置学生密码
  const handleResetPassword = async (e) => {
    e.preventDefault();
    
    if (!selectedStudent) return;
    
    try {
      setLoading(true);
      await axios.post(`/api/student-management/${selectedStudent.studentId}/reset-password`, {
        newPassword: newPassword || selectedStudent.studentId // 如未提供密码，使用学号作为重置密码
      });
      
      // 重置表单
      setSelectedStudent(null);
      setNewPassword('');
      setShowForm(false);
      
      alert(`学生 ${selectedStudent.studentId} 的密码已重置`);
    } catch (err) {
      setError(err.response?.data?.error || '重置密码失败');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };
  
  // 删除学生 (仅管理员)
  const handleDeleteStudent = async (studentId) => {
    if (!isAdmin) {
      alert('只有管理员可以删除学生');
      return;
    }
    
    if (!window.confirm(`确定要删除学生 ${studentId} 吗？此操作不可撤销！`)) {
      return;
    }
    
    try {
      setLoading(true);
      await axios.delete(`/api/student-management/${studentId}`);
      
      // 刷新学生列表
      fetchStudents();
      
      alert(`学生 ${studentId} 已删除`);
    } catch (err) {
      setError(err.response?.data?.error || '删除学生失败');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };
  
  // 批量导入学生
  const handleBatchImport = async (e) => {
    e.preventDefault();
    
    try {
      // 解析输入数据 (格式：学号,姓名 每行一条)
      const lines = batchData.split('\n').filter(line => line.trim());
      const studentsData = lines.map(line => {
        const [studentId, name] = line.split(',').map(item => item.trim());
        return { studentId, name };
      });
      
      if (studentsData.length === 0) {
        setError('没有有效的学生数据');
        return;
      }
      
      setLoading(true);
      const response = await axios.post('/api/student-management/batch', {
        students: studentsData
      });
      
      // 设置结果
      setBatchResults(response.data.results);
      
      // 刷新学生列表
      fetchStudents();
      
      alert(`批量导入完成: ${response.data.results.success.length} 成功, ${response.data.results.failed.length} 失败`);
    } catch (err) {
      setError(err.response?.data?.error || '批量导入失败');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };
  
  // 重置密码表单
  const openResetForm = (student) => {
    setFormMode('reset');
    setSelectedStudent(student);
    setShowForm(true);
    setNewPassword(''); // 清空密码字段
  };
  
  // 创建学生表单
  const openCreateForm = () => {
    setFormMode('create');
    setSelectedStudent(null);
    setNewStudentId('');
    setNewStudentName('');
    setNewPassword('');
    setShowForm(true);
  };
  
  return (
    <div className="container-fluid py-4">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h1>学生账号管理</h1>
        
        <div className="d-flex">
          {isAdmin && (
            <button
              className="btn btn-success me-2"
              onClick={() => setShowBatchForm(!showBatchForm)}
            >
              批量导入
            </button>
          )}
          
          <button
            className="btn btn-primary me-2"
            onClick={openCreateForm}
          >
            创建学生
          </button>
          
          <button
            className="btn btn-outline-secondary"
            onClick={fetchStudents}
            disabled={loading}
          >
            刷新
          </button>
        </div>
      </div>
      
      {error && (
        <div className="alert alert-danger" role="alert">
          {error}
        </div>
      )}
      
      {/* 批量导入表单 */}
      {showBatchForm && (
        <div className="card mb-4">
          <div className="card-header">
            <h5 className="mb-0">批量导入学生</h5>
          </div>
          <div className="card-body">
            <form onSubmit={handleBatchImport}>
              <div className="mb-3">
                <label htmlFor="batchData" className="form-label">学生数据 (每行一条，格式: 学号,姓名)</label>
                <textarea
                  id="batchData"
                  className="form-control"
                  rows="6"
                  value={batchData}
                  onChange={(e) => setBatchData(e.target.value)}
                  required
                  placeholder="例如:&#10;201901,张三&#10;201902,李四"
                ></textarea>
                <div className="form-text">导入后的初始密码与学号相同</div>
              </div>
              
              <div className="d-flex justify-content-end">
                <button
                  type="button"
                  className="btn btn-outline-secondary me-2"
                  onClick={() => setShowBatchForm(false)}
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="btn btn-success"
                  disabled={loading}
                >
                  {loading ? '处理中...' : '导入'}
                </button>
              </div>
            </form>
            
            {/* 批量导入结果 */}
            {batchResults && (
              <div className="mt-4">
                <h6>导入结果</h6>
                <div className="row">
                  <div className="col-md-6">
                    <div className="card bg-light">
                      <div className="card-header bg-success text-white">
                        成功导入 ({batchResults.success.length})
                      </div>
                      <div className="card-body">
                        <ul className="list-group">
                          {batchResults.success.map((student) => (
                            <li key={student.studentId} className="list-group-item">
                              {student.studentId}: {student.name}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                  
                  <div className="col-md-6">
                    <div className="card bg-light">
                      <div className="card-header bg-danger text-white">
                        导入失败 ({batchResults.failed.length})
                      </div>
                      <div className="card-body">
                        <ul className="list-group">
                          {batchResults.failed.map((student, index) => (
                            <li key={index} className="list-group-item">
                              {student.studentId}: {student.reason}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      
      {/* 创建/重置密码表单 */}
      {showForm && (
        <div className="card mb-4">
          <div className="card-header">
            <h5 className="mb-0">
              {formMode === 'create' ? '创建新学生' : `重置密码: ${selectedStudent?.name} (${selectedStudent?.studentId})`}
            </h5>
          </div>
          <div className="card-body">
            <form onSubmit={formMode === 'create' ? handleCreateStudent : handleResetPassword}>
              {formMode === 'create' && (
                <>
                  <div className="mb-3">
                    <label htmlFor="newStudentId" className="form-label">学号</label>
                    <input
                      type="text"
                      className="form-control"
                      id="newStudentId"
                      value={newStudentId}
                      onChange={(e) => setNewStudentId(e.target.value)}
                      required
                    />
                  </div>
                  
                  <div className="mb-3">
                    <label htmlFor="newStudentName" className="form-label">姓名</label>
                    <input
                      type="text"
                      className="form-control"
                      id="newStudentName"
                      value={newStudentName}
                      onChange={(e) => setNewStudentName(e.target.value)}
                      required
                    />
                  </div>
                </>
              )}
              
              <div className="mb-3">
                <label htmlFor="newPassword" className="form-label">
                  {formMode === 'create' ? '初始密码 (可选)' : '新密码 (可选)'}
                </label>
                <input
                  type="text"
                  className="form-control"
                  id="newPassword"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
                <div className="form-text">
                  {formMode === 'create' 
                    ? '如未提供，将使用学号作为初始密码' 
                    : '如未提供，将使用学号作为重置密码'}
                </div>
              </div>
              
              <div className="d-flex justify-content-end">
                <button
                  type="button"
                  className="btn btn-outline-secondary me-2"
                  onClick={() => setShowForm(false)}
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={loading}
                >
                  {loading ? '处理中...' : (formMode === 'create' ? '创建' : '重置')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      
      {/* 学生列表 */}
      <div className="card">
        <div className="card-header">
          <h5 className="mb-0">学生账号列表</h5>
        </div>
        <div className="card-body">
          {loading && students.length === 0 ? (
            <div className="text-center py-4">
              <div className="spinner-border text-primary" role="status">
                <span className="visually-hidden">Loading...</span>
              </div>
              <p className="mt-2">加载学生数据中...</p>
            </div>
          ) : students.length === 0 ? (
            <div className="alert alert-info">
              尚未创建任何学生账号
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table table-striped">
                <thead>
                  <tr>
                    <th>学号</th>
                    <th>姓名</th>
                    <th>状态</th>
                    <th>注册状态</th>
                    <th>最后活动</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {students.map((student) => (
                    <tr key={student.studentId}>
                      <td>{student.studentId}</td>
                      <td>{student.name}</td>
                      <td>
                        <span className={`badge bg-${student.status === 'online' ? 'success' : 'danger'}`}>
                          {student.status === 'online' ? '在线' : '离线'}
                        </span>
                      </td>
                      <td>
                        <span className={`badge bg-${student.registered ? 'success' : 'warning'}`}>
                          {student.registered ? '已注册' : '未注册'}
                        </span>
                      </td>
                      <td>
                        {new Date(student.lastReportTime).toLocaleString()}
                      </td>
                      <td>
                        <button
                          className="btn btn-sm btn-primary me-1"
                          onClick={() => openResetForm(student)}
                        >
                          重置密码
                        </button>
                        
                        {isAdmin && (
                          <button
                            className="btn btn-sm btn-danger"
                            onClick={() => handleDeleteStudent(student.studentId)}
                          >
                            删除
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default StudentManagement;