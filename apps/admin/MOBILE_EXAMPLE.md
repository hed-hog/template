# 📱 React Native - Implementation Example

## 🔧 Installing Dependencies

```bash
# For Expo
npx expo install expo-secure-store axios

# For React Native CLI
npm install react-native-keychain axios
```

---

## 📝 Full Implementation

### 1. **Auth Service (authService.ts)**

```typescript
import * as SecureStore from 'expo-secure-store';
import axios, { AxiosInstance } from 'axios';

const API_URL = 'https://api.yoursite.com'; // Your API in production

class AuthService {
  private api: AxiosInstance;
  private accessToken: string | null = null;

  constructor() {
    this.api = axios.create({
      baseURL: API_URL,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Interceptor to attach the access token
    this.api.interceptors.request.use(
      async (config) => {
        if (this.accessToken && !config.url?.includes('/auth/')) {
          config.headers.Authorization = `Bearer ${this.accessToken}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Interceptor for automatic refresh
    this.api.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config;

        // If 401 and it's not an auth route, try to refresh
        if (
          error.response?.status === 401 &&
          !originalRequest._retry &&
          !originalRequest.url?.includes('/auth/')
        ) {
          originalRequest._retry = true;

          try {
            const newAccessToken = await this.refreshAccessToken();
            this.accessToken = newAccessToken;
            originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
            return this.api(originalRequest);
          } catch (refreshError) {
            // Refresh failed, log out
            await this.logout();
            throw refreshError;
          }
        }

        return Promise.reject(error);
      }
    );
  }

  /**
   * Login with email and password
   */
  async login(email: string, password: string): Promise<{ accessToken: string }> {
    try {
      const response = await this.api.post('/auth/login', { email, password });
      const { accessToken, refreshToken } = response.data;

      // Save tokens
      this.accessToken = accessToken;
      await SecureStore.setItemAsync('refreshToken', refreshToken);

      return { accessToken };
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  }

  /**
   * Refresh the access token
   */
  async refreshAccessToken(): Promise<string> {
    try {
      const refreshToken = await SecureStore.getItemAsync('refreshToken');

      if (!refreshToken) {
        throw new Error('No refresh token found');
      }

      const response = await this.api.post('/auth/refresh', { refreshToken });
      const { accessToken, refreshToken: newRefreshToken } = response.data;

      // Update tokens
      this.accessToken = accessToken;
      await SecureStore.setItemAsync('refreshToken', newRefreshToken);

      return accessToken;
    } catch (error) {
      console.error('Refresh token error:', error);
      throw error;
    }
  }

  /**
   * Logout
   */
  async logout(): Promise<void> {
    try {
      const refreshToken = await SecureStore.getItemAsync('refreshToken');

      if (refreshToken) {
        // Revoke the session on the backend
        await this.api.post('/auth/logout', { refreshToken });
      }
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      // Clear tokens locally (even if the backend call fails)
      this.accessToken = null;
      await SecureStore.deleteItemAsync('refreshToken');
    }
  }

  /**
   * Check whether the user is authenticated
   */
  async isAuthenticated(): Promise<boolean> {
    const refreshToken = await SecureStore.getItemAsync('refreshToken');
    return !!refreshToken;
  }

  /**
   * Get the current access token
   */
  getAccessToken(): string | null {
    return this.accessToken;
  }

  /**
   * Make authenticated requests
   */
  async request<T>(config: any): Promise<T> {
    const response = await this.api.request(config);
    return response.data;
  }
}

export const authService = new AuthService();
```

---

### 2. **Auth Context (AuthContext.tsx)**

```typescript
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { authService } from './authService';

type User = {
  id: number;
  name: string;
  email: string;
};

type AuthContextType = {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check whether a session exists on startup
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const isAuth = await authService.isAuthenticated();
      if (isAuth) {
        // Try to fetch user data
        const userData = await authService.request<User>({
          url: '/auth/verify',
          method: 'GET',
        });
        setUser(userData);
      }
    } catch (error) {
      console.error('Auth check failed:', error);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    try {
      await authService.login(email, password);
      await checkAuth();
    } catch (error) {
      throw error;
    }
  };

  const logout = async () => {
    try {
      await authService.logout();
      setUser(null);
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        logout,
        isAuthenticated: !!user,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};
```

---

### 3. **Login Screen (LoginScreen.tsx)**

```typescript
import React, { useState } from 'react';
import { View, TextInput, Button, Text, StyleSheet, Alert } from 'react-native';
import { useAuth } from './AuthContext';

export function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    setLoading(true);
    try {
      await login(email, password);
      // Navigation will be handled by AuthProvider
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Login</Text>
      
      <TextInput
        style={styles.input}
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
      />
      
      <TextInput
        style={styles.input}
        placeholder="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />
      
      <Button
        title={loading ? 'Signing in...' : 'Sign in'}
        onPress={handleLogin}
        disabled={loading}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    padding: 10,
    marginBottom: 10,
    borderRadius: 5,
  },
});
```

---

### 4. **App Navigation (App.tsx)**

```typescript
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { AuthProvider, useAuth } from './AuthContext';
import { LoginScreen } from './LoginScreen';
import { HomeScreen } from './HomeScreen';

const Stack = createNativeStackNavigator();

function AppNavigator() {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return <Text>Loading...</Text>;
  }

  return (
    <NavigationContainer>
      <Stack.Navigator>
        {!isAuthenticated ? (
          <Stack.Screen name="Login" component={LoginScreen} />
        ) : (
          <Stack.Screen name="Home" component={HomeScreen} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppNavigator />
    </AuthProvider>
  );
}
```

---

## 🔒 Additional Security

### **Certificate Pinning (Optional, but Recommended)**

```bash
npm install react-native-ssl-pinning
```

```typescript
import { fetch } from 'react-native-ssl-pinning';

const response = await fetch('https://api.yoursite.com/auth/login', {
  method: 'POST',
  sslPinning: {
    certs: ['certificate'], // Add the certificate to the project
  },
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ email, password }),
});
```

---

## 📊 Differences: Web vs Mobile

| Aspect | Web (Next.js) | Mobile (React Native) |
|---------|---------------|----------------------|
| **Refresh Token** | httpOnly cookie | SecureStore |
| **Sending** | Automatic (cookie) | Manual (body) |
| **/login Response** | Ignores `refreshToken` | Saves `refreshToken` |
| **/refresh Response** | Ignores `refreshToken` | Updates `refreshToken` |
| **Logout** | Cookie cleared | SecureStore deleted |

---

## ✅ Implementation Checklist

- [ ] Install `expo-secure-store` or `react-native-keychain`
- [ ] Create `authService.ts` with login/refresh/logout
- [ ] Implement interceptors for automatic refresh
- [ ] Create `AuthContext` to manage global state
- [ ] Implement conditional navigation (authenticated/not authenticated)
- [ ] Add certificate pinning (production)
- [ ] Test automatic refresh when the token expires
- [ ] Test logout and session cleanup

---

## 🎯 Full Flow

```
1. Login:
   POST /auth/login { email, password }
   ← { accessToken, refreshToken }
   → Save refreshToken to SecureStore
   → Keep accessToken in memory

2. Requests:
   GET /auth/verify
   → Header: Authorization: Bearer {accessToken}

3. Expired Token (401):
   → Interceptor detects the 401
   → POST /auth/refresh { refreshToken }
   ← { accessToken, refreshToken }
   → Update tokens
   → Retry the original request

4. Logout:
   POST /auth/logout { refreshToken }
   → Delete refreshToken from SecureStore
   → Clear accessToken from memory
```
