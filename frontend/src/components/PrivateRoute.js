// frontend/src/components/PrivateRoute.js
import React, { useContext } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { AuthContext } from '../contexts/AuthContext';

const PrivateRoute = ({ children, allowStudent = false }) => {
  const { currentUser, loading } = useContext(AuthContext);
  const { studentId } = useParams();
  
  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
        <p>加载中，请稍后...</p>
      </div>
    );
  }
  
  // 如果未登录，重定向到登录页
  if (!currentUser) {
    return <Navigate to="/login" />;
  }
  
  // 如果是教师，总是允许访问
  if (!currentUser.isStudent) {
    return children;
  }
  
  // 如果是学生且路由允许学生访问
  if (currentUser.isStudent && allowStudent) {
    // 如果有学生ID参数，确保只能访问自己的页面
    if (studentId && studentId !== currentUser.studentId) {
      return <Navigate to={`/students/${currentUser.studentId}`} />;
    }
    return children;
  }
  
  // 学生尝试访问教师专属页面，重定向到自己的详情页
  return <Navigate to={`/students/${currentUser.studentId}`} />;
};

export default PrivateRoute;