import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { FlatList, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';

interface Profile {
  id: string;
  display_name: string | null;
}

interface FriendshipRow {
  friend_id: string;
  status: string;
  profiles: Profile | Profile[] | null;
}

export default function FriendsScreen() {
  const { user } = useAuthStore();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Profile[]>([]);
  const [friends, setFriends] = useState<FriendshipRow[]>([]);

  const loadFriends = useCallback(async () => {
    if (!user) {
      return;
    }

    const { data } = await supabase
      .from('friendships')
      .select('friend_id, status, profiles!friendships_friend_id_fkey(id, display_name)')
      .eq('user_id', user.id);

    setFriends((data as FriendshipRow[] | null) ?? []);
  }, [user]);

  useEffect(() => {
    void loadFriends();
  }, [loadFriends]);

  const search = async () => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    const { data } = await supabase
      .from('profiles')
      .select('id, display_name')
      .ilike('display_name', `%${query.trim()}%`)
      .limit(20);

    setResults(((data as Profile[] | null) ?? []).filter((profile) => profile.id !== user?.id));
  };

  const sendRequest = async (friendId: string) => {
    if (!user) {
      return;
    }

    await supabase
      .from('friendships')
      .insert({ user_id: user.id, friend_id: friendId, status: 'pending' });
    await loadFriends();
  };

  const removeFriend = async (friendId: string) => {
    if (!user) {
      return;
    }

    await supabase.from('friendships').delete().eq('user_id', user.id).eq('friend_id', friendId);
    await loadFriends();
  };

  const getFriendProfile = (friendship: FriendshipRow): Profile | null => {
    if (Array.isArray(friendship.profiles)) {
      return friendship.profiles[0] ?? null;
    }
    return friendship.profiles;
  };

  if (!user) {
    return (
      <View style={styles.container}>
        <Text style={styles.info}>Sign in to manage friends.</Text>
        <TouchableOpacity style={styles.btn} onPress={() => router.push('/(auth)/sign-in')}>
          <Text style={styles.btnText}>Sign In</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Friends</Text>

      <View style={styles.row}>
        <TextInput
          style={[styles.input, styles.flex]}
          value={query}
          onChangeText={setQuery}
          placeholder="Search by display name"
          placeholderTextColor="#64748b"
        />
        <TouchableOpacity
          style={styles.searchBtn}
          onPress={() => {
            void search();
          }}
        >
          <Text style={styles.btnText}>Search</Text>
        </TouchableOpacity>
      </View>

      {results.length > 0 ? (
        <FlatList
          data={results}
          keyExtractor={(item) => item.id}
          style={styles.list}
          renderItem={({ item }) => (
            <View style={styles.item}>
              <Text style={styles.name}>{item.display_name ?? 'Unknown'}</Text>
              <TouchableOpacity
                onPress={() => {
                  void sendRequest(item.id);
                }}
                style={styles.addBtn}
              >
                <Text style={styles.addBtnText}>Add</Text>
              </TouchableOpacity>
            </View>
          )}
        />
      ) : null}

      <Text style={styles.sectionTitle}>My Friends</Text>
      <FlatList
        data={friends}
        keyExtractor={(item) => item.friend_id}
        style={styles.list}
        ListEmptyComponent={<Text style={styles.empty}>No friends yet.</Text>}
        renderItem={({ item }) => {
          const profile = getFriendProfile(item);
          return (
            <View style={styles.item}>
              <Text style={styles.name}>{profile?.display_name ?? 'Unknown'}</Text>
              <Text style={styles.status}>{item.status}</Text>
              <TouchableOpacity
                onPress={() => {
                  void removeFriend(item.friend_id);
                }}
                style={styles.removeBtn}
              >
                <Text style={styles.removeBtnText}>Remove</Text>
              </TouchableOpacity>
            </View>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, backgroundColor: '#0f172a' },
  title: { fontSize: 24, fontWeight: '700', color: '#f1f5f9', marginBottom: 16, marginTop: 16 },
  info: { color: '#94a3b8', textAlign: 'center', marginBottom: 24, marginTop: 40 },
  row: { flexDirection: 'row', marginBottom: 16 },
  flex: { flex: 1 },
  input: {
    backgroundColor: '#1e293b',
    borderRadius: 8,
    padding: 12,
    color: '#f1f5f9',
    fontSize: 15,
    marginRight: 8,
  },
  btn: { backgroundColor: '#6366f1', padding: 14, borderRadius: 8, alignItems: 'center' },
  btnText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  searchBtn: { backgroundColor: '#6366f1', padding: 12, borderRadius: 8, justifyContent: 'center' },
  list: { marginBottom: 16 },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  name: { flex: 1, color: '#f1f5f9', fontSize: 15 },
  status: { color: '#94a3b8', marginRight: 8, fontSize: 13 },
  empty: { color: '#94a3b8', paddingVertical: 8 },
  sectionTitle: { color: '#cbd5e1', fontSize: 16, fontWeight: '600', marginBottom: 8 },
  addBtn: {
    backgroundColor: '#22c55e',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  addBtnText: { color: '#fff', fontWeight: '600', fontSize: 13 },
  removeBtn: {
    backgroundColor: '#dc2626',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  removeBtnText: { color: '#fff', fontWeight: '600', fontSize: 13 },
});
