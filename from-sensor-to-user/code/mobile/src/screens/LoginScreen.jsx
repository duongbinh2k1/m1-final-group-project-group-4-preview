import { useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useAuthStore } from '../store/useAuthStore'

const BASE = process.env.EXPO_PUBLIC_BACKEND_URL ?? 'http://localhost:8000'

export function LoginScreen({ onLoginSuccess }) {
  const login = useAuthStore((s) => s.login)

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error,    setError]    = useState('')
  const [loading,  setLoading]  = useState(false)

  async function handleLogin() {
    if (!username || !password) return
    setLoading(true)
    setError('')
    try {
      const res  = await fetch(`${BASE}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.detail ?? 'Login failed'); return }
      login(data.access_token, username)
      onLoginSuccess?.()
    } catch {
      setError('Cannot reach backend. Check EXPO_PUBLIC_BACKEND_URL.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.center}>
        <View style={styles.card}>
          {/* Logo */}
          <View style={styles.logoRow}>
            <View style={styles.dot} />
            <Text style={styles.logoText}>GreenHouse</Text>
          </View>
          <Text style={styles.sub}>AIoT Platform · Sign in</Text>

          {/* Fields */}
          <Text style={styles.label}>username</Text>
          <TextInput
            style={styles.input}
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="next"
          />

          <Text style={styles.label}>password</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            returnKeyType="go"
            onSubmitEditing={handleLogin}
          />

          {error ? <Text style={styles.error}>✕ {error}</Text> : null}

          <TouchableOpacity
            onPress={handleLogin}
            disabled={loading}
            style={[styles.btn, loading && styles.btnDisabled]}
          >
            <Text style={styles.btnText}>{loading ? 'signing_in...' : 'sign_in'}</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe:        { flex: 1, backgroundColor: '#F5F6F8' },
  center:      { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  card:        { backgroundColor: '#fff', borderRadius: 14, padding: 28, width: '100%', maxWidth: 360, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 16, elevation: 4 },
  logoRow:     { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  dot:         { width: 8, height: 8, borderRadius: 4, backgroundColor: '#16A34A' },
  logoText:    { fontFamily: 'monospace', fontSize: 20, fontWeight: '700', color: '#1A261A' },
  sub:         { fontFamily: 'monospace', fontSize: 11, color: '#9BB09B', marginBottom: 24 },
  label:       { fontFamily: 'monospace', fontSize: 10, color: '#9BB09B', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 6 },
  input:       { borderWidth: 1.5, borderColor: '#EAEDEA', borderRadius: 6, padding: 10, fontFamily: 'monospace', fontSize: 13, color: '#1A261A', backgroundColor: '#FAFBFC', marginBottom: 14 },
  error:       { fontFamily: 'monospace', fontSize: 11, color: '#DC2626', backgroundColor: 'rgba(220,38,38,0.06)', padding: 10, borderRadius: 6, marginBottom: 14 },
  btn:         { backgroundColor: '#16A34A', borderRadius: 6, paddingVertical: 13, alignItems: 'center' },
  btnDisabled: { backgroundColor: '#C0D0C0' },
  btnText:     { fontFamily: 'monospace', fontSize: 12, fontWeight: '700', color: '#fff', letterSpacing: 1.5, textTransform: 'uppercase' },
})
