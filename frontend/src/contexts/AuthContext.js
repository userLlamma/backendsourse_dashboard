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
    const userType = localStorage.getItem('userType'); // 'teacher' or 'student'
    
    if (token) {
      // 设置axios默认头部
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      
      // 验证token (根据用户类型)
      const verifyToken = async () => {
        try {
          let res;
          if (userType === 'student') {
            res = await axios.get('/api/student-auth/me');
          } else {
            res = await axios.get('/api/auth/me');
          }
          
          setCurrentUser({
            ...res.data,
            isStudent: userType === 'student'
          });
          setError(null);
        } catch (err) {
          // Token无效，清除本地存储
          localStorage.removeItem('authToken');
          localStorage.removeItem('userType');
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
  
  // 教师登录
  const teacherLogin = async (username, password) => {
    try {
      setLoading(true);
      setError(null);
      
      const res = await axios.post('/api/auth/login', { username, password });
      
      // 保存token到本地存储
      localStorage.setItem('authToken', res.data.token);
      localStorage.setItem('userType', 'teacher');
      
      // 设置axios默认头部
      axios.defaults.headers.common['Authorization'] = `Bearer ${res.data.token}`;
      
      setCurrentUser({
        ...res.data.user,
        isStudent: false
      });
      return true;
    } catch (err) {
      setError(err.response?.data?.error || '登录失败');
      return false;
    } finally {
      setLoading(false);
    }
  };
  
  // 学生登录
  const studentLogin = async (studentId, password) => {
    try {
      setLoading(true);
      setError(null);
      
      const res = await axios.post('/api/student-auth/login', { studentId, password });
      
      // 保存token到本地存储
      localStorage.setItem('authToken', res.data.token);
      localStorage.setItem('userType', 'student');
      
      // 设置axios默认头部
      axios.defaults.headers.common['Authorization'] = `Bearer ${res.data.token}`;
      
      setCurrentUser({
        ...res.data.user,
        isStudent: true
      });
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
    localStorage.removeItem('userType');
    
    // 清除axios头部
    delete axios.defaults.headers.common['Authorization'];
    
    setCurrentUser(null);
  };
  
  const value = {
    currentUser,
    loading,
    error,
    teacherLogin,
    studentLogin,
    logout
  };
  
  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};