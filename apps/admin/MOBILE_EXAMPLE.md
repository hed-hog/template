# 📱 React Native - Exemplo de Implementação

## 🔧 Instalação de Dependências

```bash
# Para Expo
npx expo install expo-secure-store axios

# Para React Native CLI
npm install react-native-keychain axios
```

---

## 📝 Implementação Completa

### 1. **Auth Service (authService.ts)**

```typescript
import * as SecureStore from 'expo-secure-store';
import axios, { AxiosInstance } from 'axios';

const API_URL = 'https://api.seusite.com'; // Sua API em produção

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

    // Interceptor para adicionar access token
    this.api.interceptors.request.use(
      async (config) => {
        if (this.accessToken && !config.url?.includes('/auth/')) {
          config.headers.Authorization = `Bearer ${this.accessToken}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Interceptor para refresh automático
    this.api.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config;

        // Se 401 e não é rota de auth, tentar refresh
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
            // Refresh falhou, fazer logout
            await this.logout();
            throw refreshError;
          }
        }

        return Promise.reject(error);
      }
    );
  }

  /**
   * Login com email e senha
   */
  async login(email: string, password: string): Promise<{ accessToken: string }> {
    try {
      const response = await this.api.post('/auth/login', { email, password });
      const { accessToken, refreshToken } = response.data;

      // Salvar tokens
      this.accessToken = accessToken;
      await SecureStore.setItemAsync('refreshToken', refreshToken);

      return { accessToken };
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  }

  /**
   * Refresh do access token
   */
  async refreshAccessToken(): Promise<string> {
    try {
      const refreshToken = await SecureStore.getItemAsync('refreshToken');

      if (!refreshToken) {
        throw new Error('No refresh token found');
      }

      const response = await this.api.post('/auth/refresh', { refreshToken });
      const { accessToken, refreshToken: newRefreshToken } = response.data;

      // Atualizar tokens
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
        // Revogar sessão no backend
        await this.api.post('/auth/logout', { refreshToken });
      }
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      // Limpar tokens localmente (mesmo se backend falhar)
      this.accessToken = null;
      await SecureStore.deleteItemAsync('refreshToken');
    }
  }

  /**
   * Verificar se está autenticado
   */
  async isAuthenticated(): Promise<boolean> {
    const refreshToken = await SecureStore.getItemAsync('refreshToken');
    return !!refreshToken;
  }

  /**
   * Obter access token atual
   */
  getAccessToken(): string | null {
    return this.accessToken;
  }

  /**
   * Fazer requisições autenticadas
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
    // Verificar se há sessão ao iniciar
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const isAuth = await authService.isAuthenticated();
      if (isAuth) {
        // Tentar obter dados do usuário
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
      Alert.alert('Erro', 'Preencha todos os campos');
      return;
    }

    setLoading(true);
    try {
      await login(email, password);
      // Navegação será tratada pelo AuthProvider
    } catch (error: any) {
      Alert.alert('Erro', error.response?.data?.message || 'Login falhou');
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
        placeholder="Senha"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />
      
      <Button
        title={loading ? 'Entrando...' : 'Entrar'}
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
    return <Text>Carregando...</Text>;
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

## 🔒 Segurança Adicional

### **Certificate Pinning (Opcional, mas Recomendado)**

```bash
npm install react-native-ssl-pinning
```

```typescript
import { fetch } from 'react-native-ssl-pinning';

const response = await fetch('https://api.seusite.com/auth/login', {
  method: 'POST',
  sslPinning: {
    certs: ['certificate'], // Adicionar certificado ao projeto
  },
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ email, password }),
});
```

---

## 📊 Diferenças: Web vs Mobile

| Aspecto | Web (Next.js) | Mobile (React Native) |
|---------|---------------|----------------------|
| **Refresh Token** | Cookie httpOnly | SecureStore |
| **Envio** | Automático (cookie) | Manual (body) |
| **Resposta /login** | Ignora `refreshToken` | Salva `refreshToken` |
| **Resposta /refresh** | Ignora `refreshToken` | Atualiza `refreshToken` |
| **Logout** | Cookie limpado | SecureStore deletado |

---

## ✅ Checklist de Implementação

- [ ] Instalar `expo-secure-store` ou `react-native-keychain`
- [ ] Criar `authService.ts` com login/refresh/logout
- [ ] Implementar interceptors para refresh automático
- [ ] Criar `AuthContext` para gerenciar estado global
- [ ] Implementar navegação condicional (autenticado/não autenticado)
- [ ] Adicionar certificate pinning (produção)
- [ ] Testar refresh automático quando token expira
- [ ] Testar logout e limpeza de sessão

---

## 🎯 Fluxo Completo

```
1. Login:
   POST /auth/login { email, password }
   ← { accessToken, refreshToken }
   → Salvar refreshToken no SecureStore
   → Guardar accessToken na memória

2. Requisições:
   GET /auth/verify
   → Header: Authorization: Bearer {accessToken}

3. Token Expirado (401):
   → Interceptor detecta 401
   → POST /auth/refresh { refreshToken }
   ← { accessToken, refreshToken }
   → Atualizar tokens
   → Retentar requisição original

4. Logout:
   POST /auth/logout { refreshToken }
   → Deletar refreshToken do SecureStore
   → Limpar accessToken da memória
```
