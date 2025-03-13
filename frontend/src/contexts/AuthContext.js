// frontend/src/contexts/AuthContext.js
import React, { createContext, useState, useEffect } from 'react';
import axios from 'axios';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  useEffect(() => {
    // 检查本地存储的token
    const token = localStorage.getItem('authToken');
    
    if (token) {
      // 设置axios默认头部
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      
      // 验证token
      const verifyToken = async () => {
        try {
          const res = await axios.get('/api/auth/me');
          setCurrentUser(res.data);
          setError(null);
        } catch (err) {
          // Token无效，清除本地存储
          localStorage.removeItem('authToken');
          delete axios.defaults.headers.common['Authorization'];
          setCurrentUser(null);
          setError('登录会话已过期，请重新登录');
        } finally {
          setLoading(false);
        }
      };
      
      verifyToken();
    } else {
      setLoading(false);
    }
  }, []);
  
  // 登录
  const login = async (username, password) => {
    try {
      setLoading(true);
      setError(null);
      
      const res = await axios.post('/api/auth/login', { username, password });
      
      // 保存token到本地存储
      localStorage.setItem('authToken', res.data.token);
      
      // 设置axios默认头部
      axios.defaults.headers.common['Authorization'] = `Bearer ${res.data.token}`;
      
      setCurrentUser(res.data.user);
      return true;
    } catch (err) {
      setError(err.response?.data?.error || '登录失败');
      return false;
    } finally {
      setLoading(false);
    }
  };
  
  // 登出
  const logout = () => {
    // 清除本地存储
    localStorage.removeItem('authToken');
    
    // 清除axios头部
    delete axios.defaults.headers.common['Authorization'];
    
    setCurrentUser(null);
  };
  
  const value = {
    currentUser,
    loading,
    error,
    login,
    logout
  };
  
  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};