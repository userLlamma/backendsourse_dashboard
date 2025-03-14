// frontend/src/components/StudentRoute.js
import React, { useContext } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { AuthContext } from '../contexts/AuthContext';

/**
 * Component for student-only routes with student ID validation
 * Students can only access their own data
 */
const StudentRoute = ({ children }) => {
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
    return <Navigate to="/student-login" />;
  }
  
  // 如果是教师，总是允许访问
  if (!currentUser.isStudent) {
    return children;
  }
  
  // 学生只能访问自己的数据
  if (currentUser.studentId === studentId) {
    return children;
  }
  
  // 如果是学生但尝试访问其他学生的数据，重定向到自己的详情页
  return <Navigate to={`/students/${currentUser.studentId}`} />;
};

export default StudentRoute;