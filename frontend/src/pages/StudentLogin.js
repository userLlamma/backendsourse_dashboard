// frontend/src/pages/StudentLogin.js
import React, { useState, useContext, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../contexts/AuthContext';
import { Link } from 'react-router-dom';

const StudentLogin = () => {
  const [studentId, setStudentId] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  const { studentLogin, error, currentUser } = useContext(AuthContext);
  const navigate = useNavigate();
  
  useEffect(() => {
    // 如果已登录，重定向到学生详情页
    if (currentUser && currentUser.isStudent) {
      navigate(`/students/${currentUser.studentId}`);
    } else if (currentUser && !currentUser.isStudent) {
      // 如果已登录为教师，重定向到首页
      navigate('/');
    }
  }, [currentUser, navigate]);
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    
    const success = await studentLogin(studentId, password);
    
    if (success) {
      navigate(`/students/${studentId}`);
    }
    
    setIsLoading(false);
  };
  
  return (
    <div className="login-container d-flex justify-content-center align-items-center vh-100">
      <div className="card login-card" style={{ maxWidth: '400px', width: '100%' }}>
        <div className="card-header bg-success text-white">
          <h4 className="mb-0">课程监控系统</h4>
        </div>
        <div className="card-body">
          <h5 className="card-title text-center mb-4">学生登录</h5>
          
          {error && (
            <div className="alert alert-danger" role="alert">
              {error}
            </div>
          )}
          
          <form onSubmit={handleSubmit}>
            <div className="mb-3">
              <label htmlFor="studentId" className="form-label">学号</label>
              <input
                type="text"
                className="form-control"
                id="studentId"
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
                required
              />
            </div>
            
            <div className="mb-3">
              <label htmlFor="password" className="form-label">密码</label>
              <input
                type="password"
                className="form-control"
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <div className="form-text">初始密码与学号相同，首次使用reporter.js后可登录</div>
            </div>
            
            <button 
              type="submit" 
              className="btn btn-success w-100 mt-3"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                  &nbsp;登录中...
                </>
              ) : '学生登录'}
            </button>
            
            <div className="text-center mt-3">
              <Link to="/login" className="btn btn-link">教师登录</Link>
            </div>
          </form>
          
          <div className="alert alert-info mt-4">
            <h6 className="alert-heading">学生须知</h6>
            <p className="mb-0">
              1. 首次登录前需使用reporter.js上报你的API状态<br/>
              2. 如果忘记密码，请联系教师重置
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StudentLogin;