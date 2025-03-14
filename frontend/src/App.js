// frontend/src/App.js
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import PrivateRoute from './components/PrivateRoute';

// 页面组件
import Dashboard from './pages/Dashboard';
import StudentList from './pages/StudentList';
import StudentDetail from './pages/StudentDetail';
import Leaderboard from './pages/Leaderboard';
import Login from './pages/Login';
import NavBar from './components/NavBar';

import './App.css';

function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="app-container">
          <Routes>
            <Route path="/login" element={<Login />} />
            
            {/* 私有路由 */}
            <Route
              path="/"
              element={
                <PrivateRoute>
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
                <PrivateRoute>
                  <NavBar />
                  <div className="content-container">
                    <StudentList />
                  </div>
                </PrivateRoute>
              }
            />
            
            <Route
              path="/students/:studentId"
              element={
                <PrivateRoute>
                  <NavBar />
                  <div className="content-container">
                    <StudentDetail />
                  </div>
                </PrivateRoute>
              }
            />
            
            <Route
              path="/leaderboard"
              element={
                <PrivateRoute>
                  <NavBar />
                  <div className="content-container">
                    <Leaderboard />
                  </div>
                </PrivateRoute>
              }
            />
            
            {/* 默认重定向到dashboard */}
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;