// frontend/src/pages/Login.js
import React, { useState, useContext, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../contexts/AuthContext';

const Login = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  const { login, error, currentUser } = useContext(AuthContext);
  const navigate = useNavigate();
  
  useEffect(() => {
    // 如果已登录，重定向到首页
    if (currentUser) {
      navigate('/');
    }
  }, [currentUser, navigate]);
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    
    const success = await login(username, password);
    
    if (success) {
      navigate('/');
    }
    
    setIsLoading(false);
  };
  
  return (
    <div className="login-container d-flex justify-content-center align-items-center vh-100">
      <div className="card login-card">
        <div className="card-header bg-primary text-white">
          <h4 className="mb-0">课程监控系统</h4>
        </div>
        <div className="card-body">
          <h5 className="card-title text-center mb-4">教师登录</h5>
          
          {error && (
            <div className="alert alert-danger" role="alert">
              {error}
            </div>
          )}
          
          <form onSubmit={handleSubmit}>
            <div className="mb-3">
              <label htmlFor="username" className="form-label">用户名</label>
              <input
                type="text"
                className="form-control"
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
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
            </div>
            
            <button 
              type="submit" 
              className="btn btn-primary w-100 mt-3"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                  &nbsp;登录中...
                </>
              ) : '登录'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Login;