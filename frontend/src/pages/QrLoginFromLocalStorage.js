// frontend/src/pages/QrLoginFromLocalStorage.js
import React, { useEffect, useContext } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { AuthContext } from '../contexts/AuthContext'; // Import AuthContext

const QrLoginFromLocalStorage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { loginWithJwt } = useContext(AuthContext); // Get loginWithJwt from AuthContext

  useEffect(() => {
    const queryParams = new URLSearchParams(location.search);
    const studentId = queryParams.get('studentId');
    const localStorageJwt = localStorage.getItem('authToken');
    const queryParamJwt = queryParams.get('jwt');

    // Prioritize JWT from localStorage, then query parameter
    const jwt = localStorageJwt || queryParamJwt;

    if (jwt && studentId) {
      // Make a request to the backend with the JWT in the header
      axios.get(`/api/students/${studentId}`, {
        headers: {
          'Authorization': `Bearer ${jwt}`
        }
      })
        .then(response => {
          // If the request is successful, redirect to the student detail page
          // If the JWT came from the query parameter, store it in localStorage for future use
          if (queryParamJwt) {
            localStorage.setItem('authToken', queryParamJwt);
            localStorage.setItem('userType', 'student'); // Add this line
          }
          // Update the AuthContext with the user details
          loginWithJwt(jwt, response.data); // Call loginWithJwt
          navigate(`/students/${studentId}`);
        })
        .catch(error => {
          console.error('Error authenticating with JWT:', error);
          // Handle authentication error (e.g., redirect to login page)
          navigate('/student-login');
        });
    } else {
      // Handle error (e.g., missing JWT or studentId)
      console.error('Invalid QR code login URL or missing JWT');
      navigate('/student-login'); // Redirect to login page
    }
  }, [location, navigate]);

  return (
    <div className="container-fluid py-4">
      <div className="alert alert-info" role="alert">
        正在登录...
      </div>
    </div>
  );
};

export default QrLoginFromLocalStorage;
