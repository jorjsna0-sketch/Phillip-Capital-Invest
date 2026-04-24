import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import axios from 'axios';

const AuthContext = createContext();

const API_URL = process.env.REACT_APP_BACKEND_URL;

// Create axios instance WITHOUT credentials (Safari ITP blocks cross-origin cookies)
// We use Authorization header with Bearer token instead
const api = axios.create({
  baseURL: `${API_URL}/api`,
  withCredentials: false,  // Disabled to avoid Safari ITP issues
  headers: {
    'Content-Type': 'application/json'
  }
});

// Add auth header interceptor
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('session_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const checkAuth = useCallback(async () => {
    const token = localStorage.getItem('session_token');
    // Only check auth if we have a token
    if (!token) {
      setLoading(false);
      return null;
    }
    
    try {
      const response = await api.get('/auth/me');
      setUser(response.data);
      return response.data;
    } catch (err) {
      setUser(null);
      localStorage.removeItem('session_token');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const login = async (email, password) => {
    try {
      setError(null);
      const response = await api.post('/auth/login', { email, password });
      
      // If 2FA is required, don't set user yet
      if (response.data.requires_2fa) {
        return response.data;
      }
      
      const sessionToken = response.data.session_token;
      if (sessionToken) {
        localStorage.setItem('session_token', sessionToken);
      }
      
      // Fetch full user data after login with explicit token header
      const userResponse = await api.get('/auth/me', {
        headers: sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {}
      });
      setUser(userResponse.data);
      setLoading(false);
      return userResponse.data;
    } catch (err) {
      const message = err.response?.data?.detail || 'Login failed';
      setError(message);
      throw new Error(message);
    }
  };

  const register = async (email, password, name) => {
    try {
      setError(null);
      const response = await api.post('/auth/register', { email, password, name });
      if (response.data.session_token) {
        localStorage.setItem('session_token', response.data.session_token);
      }
      setUser(response.data);
      return response.data;
    } catch (err) {
      const message = err.response?.data?.detail || 'Registration failed';
      setError(message);
      throw new Error(message);
    }
  };

  const processOAuthSession = async (sessionId) => {
    try {
      setError(null);
      const response = await api.post('/auth/session', { session_id: sessionId });
      if (response.data.session_token) {
        localStorage.setItem('session_token', response.data.session_token);
      }
      setUser(response.data);
      return response.data;
    } catch (err) {
      const message = err.response?.data?.detail || 'OAuth authentication failed';
      setError(message);
      throw new Error(message);
    }
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      setUser(null);
      localStorage.removeItem('session_token');
    }
  };

  const refreshUser = async () => {
    return await checkAuth();
  };

  const isAdmin = user?.role === 'admin';

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      error,
      login,
      register,
      logout,
      processOAuthSession,
      refreshUser,
      checkAuth,
      isAdmin,
      api
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export { api };
export default AuthContext;
