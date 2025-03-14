// frontend/src/App.js
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import PrivateRoute from './components/PrivateRoute';
import StudentRoute from './components/StudentRoute';

// 页面组件
import Dashboard from './pages/Dashboard';
import StudentList from './pages/StudentList';
import StudentDetail from './pages/StudentDetail';
import Leaderboard from './pages/Leaderboard';
import Login from './pages/Login';
import StudentLogin from './pages/StudentLogin';
import StudentManagement from './pages/StudentManagement';
import NavBar from './components/NavBar';
import GradeExport from './pages/GradeExport';  // 成绩导出

import './App.css';

function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="app-container">
          <Routes>
            {/* 公共路由 */}
            <Route path="/login" element={<Login />} />
            <Route path="/student-login" element={<StudentLogin />} />
            
            {/* 教师路由 */}
            <Route
              path="/"
              element={
                <PrivateRoute allowStudent={false}>
                  <NavBar />
                  <div className="content-container">
                    <Dashboard />
                  </div>
                </PrivateRoute>
              }
            />
            
            <Route
              path="/students"
              element={
                <PrivateRoute allowStudent={false}>
                  <NavBar />
                  <div className="content-container">
                    <StudentList />
                  </div>
                </PrivateRoute>
              }
            />
            
            <Route
              path="/student-management"
              element={
                <PrivateRoute allowStudent={false}>
                  <NavBar />
                  <div className="content-container">
                    <StudentManagement />
                  </div>
                </PrivateRoute>
              }
            />

            {/* 成绩导出 - 仅教师可见 */}
            <Route
              path="/grade-export"
              element={
                <PrivateRoute allowStudent={false}>
                  <NavBar />
                  <div className="content-container">
                    <GradeExport />
                  </div>
                </PrivateRoute>
              }
            />
            
            {/* 学生详情页 - 对教师和学生都可见 */}
            <Route
              path="/students/:studentId"
              element={
                <PrivateRoute allowStudent={true}>
                  <NavBar />
                  <div className="content-container">
                    <StudentDetail />
                  </div>
                </PrivateRoute>
              }
            />
            
            {/* 排行榜 - 对教师和学生都可见 */}
            <Route
              path="/leaderboard"
              element={
                <PrivateRoute allowStudent={true}>
                  <NavBar />
                  <div className="content-container">
                    <Leaderboard />
                  </div>
                </PrivateRoute>
              }
            />
            
            {/* 默认重定向 */}
            <Route 
              path="*" 
              element={
                <Navigate to="/" />
              }
            />
          </Routes>
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;