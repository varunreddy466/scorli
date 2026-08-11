import { router } from 'expo-router';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';

WebBrowser.maybeCompleteAuthSession();

function getSessionParams(callbackUrl: string): URLSearchParams {
  return new URL(callbackUrl.replace('#', '?')).searchParams;
}

export default function SignInScreen() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [magicSent, setMagicSent] = useState(false);
  const [appleAvailable, setAppleAvailable] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'ios') {
      return;
    }

    AppleAuthentication.isAvailableAsync()
      .then(setAppleAvailable)
      .catch(() => setAppleAvailable(false));
  }, []);

  const googleRedirectUrl = useMemo(() => AuthSession.makeRedirectUri({ scheme: 'scorli' }), []);

  const skipSignIn = () => {
    router.replace('/');
  };

  const sendMagicLink = async () => {
    if (!email.trim()) {
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.signInWithOtp({ email: email.trim() });
    setLoading(false);

    if (error) {
      Alert.alert('Error', error.message);
      return;
    }

    setMagicSent(true);
  };

  const signInWithApple = async () => {
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      if (!credential.identityToken) {
        Alert.alert('Error', 'Apple Sign In did not return an identity token.');
        return;
      }

      const { error } = await supabase.auth.signInWithIdToken({
        provider: 'apple',
        token: credential.identityToken,
      });

      if (error) {
        Alert.alert('Error', error.message);
        return;
      }

      router.replace('/');
    } catch {
      // User cancelled sign-in.
    }
  };

  const signInWithGoogle = async () => {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: googleRedirectUrl, skipBrowserRedirect: true },
    });

    if (error || !data.url) {
      Alert.alert('Error', error?.message ?? 'Unable to start Google sign-in.');
      return;
    }

    const result = await WebBrowser.openAuthSessionAsync(data.url, googleRedirectUrl);
    if (result.type !== 'success') {
      return;
    }

    const params = getSessionParams(result.url);
    const accessToken = params.get('access_token');
    const refreshToken = params.get('refresh_token');

    if (!accessToken || !refreshToken) {
      Alert.alert('Error', 'Google sign-in did not return a session.');
      return;
    }

    const { error: sessionError } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });

    if (sessionError) {
      Alert.alert('Error', sessionError.message);
      return;
    }

    router.replace('/');
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Sign in to Scorli</Text>
      <Text style={styles.subtitle}>Save games to the cloud and play across devices</Text>
      {!isSupabaseConfigured ? (
        <Text style={styles.notice}>
          Cloud sign-in is unavailable until Supabase env vars are configured.
        </Text>
      ) : null}

      {magicSent ? (
        <Text style={styles.info}>✓ Check your email for a sign-in link!</Text>
      ) : (
        <>
          <TextInput
            style={styles.input}
            placeholder="Email address"
            placeholderTextColor="#64748b"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />
          <TouchableOpacity
            style={[styles.btn, !isSupabaseConfigured && styles.disabledBtn]}
            onPress={() => {
              void sendMagicLink();
            }}
            disabled={loading || !isSupabaseConfigured}
          >
            <Text style={styles.btnText}>{loading ? 'Sending…' : 'Send Magic Link'}</Text>
          </TouchableOpacity>
        </>
      )}

      {appleAvailable ? (
        <AppleAuthentication.AppleAuthenticationButton
          buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
          buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
          cornerRadius={8}
          style={styles.appleBtn}
          onPress={() => {
            void signInWithApple();
          }}
        />
      ) : null}

      <TouchableOpacity
        style={[styles.btn, styles.googleBtn, !isSupabaseConfigured && styles.disabledBtn]}
        onPress={() => {
          void signInWithGoogle();
        }}
        disabled={!isSupabaseConfigured}
      >
        <Text style={styles.btnText}>Continue with Google</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.skipBtn} onPress={skipSignIn}>
        <Text style={styles.skipText}>Continue without an account →</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, justifyContent: 'center', backgroundColor: '#0f172a' },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#f1f5f9',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: { fontSize: 14, color: '#94a3b8', textAlign: 'center', marginBottom: 16 },
  notice: { color: '#fbbf24', textAlign: 'center', marginBottom: 16, fontSize: 13 },
  info: { color: '#22c55e', textAlign: 'center', marginBottom: 16, fontSize: 16 },
  input: {
    backgroundColor: '#1e293b',
    borderRadius: 8,
    padding: 14,
    color: '#f1f5f9',
    marginBottom: 12,
    fontSize: 16,
  },
  btn: {
    backgroundColor: '#6366f1',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 12,
  },
  disabledBtn: { opacity: 0.5 },
  btnText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  googleBtn: { backgroundColor: '#4285f4' },
  appleBtn: { width: '100%', height: 48, marginBottom: 12 },
  skipBtn: { marginTop: 16, alignItems: 'center' },
  skipText: { color: '#94a3b8', fontSize: 15 },
});
