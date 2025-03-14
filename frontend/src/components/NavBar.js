// frontend/src/components/NavBar.js
import React, { useContext } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { AuthContext } from '../contexts/AuthContext';

const NavBar = () => {
  const { currentUser, logout } = useContext(AuthContext);
  const location = useLocation();
  const navigate = useNavigate();
  
  const handleLogout = () => {
    logout();
    if (currentUser?.isStudent) {
      navigate('/student-login');
    } else {
      navigate('/login');
    }
  };
  
  return (
    <nav className="navbar navbar-expand-lg navbar-dark bg-primary">
      <div className="container-fluid">
        <Link className="navbar-brand" to={currentUser?.isStudent ? `/students/${currentUser.studentId}` : "/"}>
          课程监控系统 {currentUser?.isStudent && '- 学生版'}
        </Link>
        
        <button 
          className="navbar-toggler" 
          type="button" 
          data-bs-toggle="collapse" 
          data-bs-target="#navbarNav"
        >
          <span className="navbar-toggler-icon"></span>
        </button>
        
        <div className="collapse navbar-collapse" id="navbarNav">
          <ul className="navbar-nav me-auto">
            {/* 教师菜单项 */}
            {currentUser && !currentUser.isStudent && (
              <>
                <li className="nav-item">
                  <Link 
                    className={`nav-link ${location.pathname === '/' ? 'active' : ''}`} 
                    to="/"
                  >
                    仪表板
                  </Link>
                </li>
                <li className="nav-item">
                  <Link 
                    className={`nav-link ${location.pathname === '/students' ? 'active' : ''}`} 
                    to="/students"
                  >
                    学生列表
                  </Link>
                </li>
                <li className="nav-item">
                  <Link 
                    className={`nav-link ${location.pathname === '/student-management' ? 'active' : ''}`} 
                    to="/student-management"
                  >
                    学生管理
                  </Link>
                </li>

                <li className="nav-item">
                  <Link 
                    className={`nav-link ${location.pathname === '/grade-export' ? 'active' : ''}`} 
                    to="/grade-export"
                  >
                    成绩导出
                  </Link>
                </li>

              </>
            )}
            
            {/* 公共菜单项 */}
            <li className="nav-item">
              <Link 
                className={`nav-link ${location.pathname === '/leaderboard' ? 'active' : ''}`} 
                to="/leaderboard"
              >
                排行榜
              </Link>
            </li>
            
            {/* 学生菜单项 */}
            {currentUser && currentUser.isStudent && (
              <li className="nav-item">
                <Link 
                  className={`nav-link ${location.pathname === `/students/${currentUser.studentId}` ? 'active' : ''}`} 
                  to={`/students/${currentUser.studentId}`}
                >
                  我的详情
                </Link>
              </li>
            )}
          </ul>
          
          <div className="d-flex align-items-center">
            {currentUser && (
              <>
                <span className="text-light me-3">
                  {currentUser.isStudent ? '学生: ' : '教师: '}
                  {currentUser.name || currentUser.username || currentUser.studentId}
                </span>
                <button 
                  className="btn btn-outline-light" 
                  onClick={handleLogout}
                >
                  登出
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
};

export default NavBar;