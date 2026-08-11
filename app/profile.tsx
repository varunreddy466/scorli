import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';

interface ProfileData {
  display_name: string | null;
  avatar_url: string | null;
}

export default function ProfileScreen() {
  const { user, signOut, deleteAccount } = useAuthStore();
  const [profile, setProfile] = useState<ProfileData>({ display_name: null, avatar_url: null });
  const [displayName, setDisplayName] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) {
      return;
    }

    supabase
      .from('profiles')
      .select('display_name, avatar_url')
      .eq('id', user.id)
      .single()
      .then(({ data, error }) => {
        if (error || !data) {
          return;
        }
        setProfile(data);
        setDisplayName(data.display_name ?? '');
      });
  }, [user]);

  const saveProfile = async () => {
    if (!user) {
      return;
    }

    setSaving(true);
    const { error } = await supabase
      .from('profiles')
      .update({ display_name: displayName.trim() || null })
      .eq('id', user.id);
    setSaving(false);

    if (error) {
      Alert.alert('Error', error.message);
      return;
    }

    setProfile((current) => ({ ...current, display_name: displayName.trim() || null }));
  };

  const confirmDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'This permanently deletes your account and all cloud data. Local games remain on this device. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            void deleteAccount().then(() => {
              router.replace('/');
            });
          },
        },
      ],
    );
  };

  if (!user) {
    return (
      <View style={styles.container}>
        <Text style={styles.info}>You're not signed in.</Text>
        <TouchableOpacity style={styles.btn} onPress={() => router.push('/(auth)/sign-in')}>
          <Text style={styles.btnText}>Sign In</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Profile</Text>
      <Text style={styles.email}>{user.email}</Text>
      <Text style={styles.meta}>Current name: {profile.display_name ?? 'Not set'}</Text>

      <Text style={styles.label}>Display Name</Text>
      <TextInput
        style={styles.input}
        value={displayName}
        onChangeText={setDisplayName}
        placeholder="Your name"
        placeholderTextColor="#64748b"
      />
      <TouchableOpacity
        style={styles.btn}
        onPress={() => {
          void saveProfile();
        }}
        disabled={saving}
      >
        <Text style={styles.btnText}>{saving ? 'Saving…' : 'Save'}</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.btn, styles.signOutBtn]}
        onPress={() => {
          void signOut();
        }}
      >
        <Text style={styles.btnText}>Sign Out</Text>
      </TouchableOpacity>

      <TouchableOpacity style={[styles.btn, styles.deleteBtn]} onPress={confirmDeleteAccount}>
        <Text style={styles.btnText}>Delete Account</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, backgroundColor: '#0f172a' },
  title: { fontSize: 24, fontWeight: '700', color: '#f1f5f9', marginBottom: 4, marginTop: 16 },
  email: { color: '#94a3b8', marginBottom: 8 },
  meta: { color: '#cbd5e1', marginBottom: 16 },
  label: { color: '#cbd5e1', marginBottom: 4, marginTop: 16 },
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
  btnText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  signOutBtn: { backgroundColor: '#475569', marginTop: 8 },
  deleteBtn: { backgroundColor: '#dc2626', marginTop: 8 },
  info: { color: '#94a3b8', textAlign: 'center', marginBottom: 24, marginTop: 40 },
});
