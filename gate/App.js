import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  Alert,
  RefreshControl,
  Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { initializeApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  addDoc,
  updateDoc,
  doc,
  getDocs,
  query,
  where,
  orderBy,
  serverTimestamp,
} from 'firebase/firestore';

// Firebase Configuration (Replace with your own)
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_AUTH_DOMAIN",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_STORAGE_BUCKET",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Icons as text (using emoji for simplicity)
const Icons = {
  checkIn: '➡️',
  checkOut: '⬅️',
  users: '👥',
  history: '🕐',
  car: '🚗',
  success: '✅',
  error: '❌',
};

const GatemanApp = () => {
  const [activeTab, setActiveTab] = useState('checkin');
  const [formData, setFormData] = useState({
    idNumber: '',
    mobileNumber: '',
    firstName: '',
    lastName: '',
    carPlate: '',
  });
  const [searchId, setSearchId] = useState('');
  const [activeVisitors, setActiveVisitors] = useState([]);
  const [recentActivity, setRecentActivity] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    await Promise.all([loadActiveVisitors(), loadRecentActivity()]);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const loadActiveVisitors = async () => {
    try {
      const q = query(
        collection(db, 'visitors'),
        where('status', '==', 'inside'),
        orderBy('timeIn', 'desc')
      );
      const snapshot = await getDocs(q);
      const visitors = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        timeIn: doc.data().timeIn?.toDate(),
      }));
      setActiveVisitors(visitors);
    } catch (error) {
      console.error('Error loading visitors:', error);
    }
  };

  const loadRecentActivity = async () => {
    try {
      const q = query(
        collection(db, 'visitors'),
        orderBy('timeIn', 'desc')
      );
      const snapshot = await getDocs(q);
      const activities = snapshot.docs.slice(0, 50).map(doc => ({
        id: doc.id,
        ...doc.data(),
        timeIn: doc.data().timeIn?.toDate(),
        timeOut: doc.data().timeOut?.toDate(),
      }));
      setRecentActivity(activities);
    } catch (error) {
      console.error('Error loading activity:', error);
    }
  };

  const validateForm = () => {
    const { idNumber, mobileNumber, firstName, lastName, carPlate } = formData;

    if (!idNumber || idNumber.length !== 8 || !/^\d{8}$/.test(idNumber)) {
      Alert.alert('Validation Error', 'ID must be exactly 8 digits');
      return false;
    }

    if (!mobileNumber || !/^(?:254|\+254|0)?([17]\d{8})$/.test(mobileNumber)) {
      Alert.alert('Validation Error', 'Mobile number must be a valid Kenyan number (e.g., 0712345678)');
      return false;
    }

    if (!firstName.trim() || !lastName.trim()) {
      Alert.alert('Validation Error', 'First name and last name are required');
      return false;
    }

    if (carPlate && !/^[A-Z]{3}\d{3}[A-Z]$/i.test(carPlate.toUpperCase())) {
      Alert.alert('Validation Error', 'Car plate must be in Kenyan format (e.g., KBM243T)');
      return false;
    }

    return true;
  };

  const handleCheckIn = async () => {
    if (!validateForm()) return;

    setLoading(true);

    try {
      const q = query(
        collection(db, 'visitors'),
        where('idNumber', '==', formData.idNumber),
        where('status', '==', 'inside')
      );
      const snapshot = await getDocs(q);

      if (!snapshot.empty) {
        Alert.alert('Error', 'This person is already checked in!');
        setLoading(false);
        return;
      }

      await addDoc(collection(db, 'visitors'), {
        idNumber: formData.idNumber,
        mobileNumber: formData.mobileNumber.replace(/^(\+254|254|0)/, '254'),
        firstName: formData.firstName.trim(),
        lastName: formData.lastName.trim(),
        carPlate: formData.carPlate.toUpperCase().trim() || null,
        timeIn: serverTimestamp(),
        timeOut: null,
        status: 'inside',
        createdAt: serverTimestamp(),
      });

      Alert.alert('Success', `${formData.firstName} ${formData.lastName} checked in successfully!`);
      setFormData({ idNumber: '', mobileNumber: '', firstName: '', lastName: '', carPlate: '' });

      await loadData();
    } catch (error) {
      console.error('Check-in error:', error);
      Alert.alert('Error', 'Error during check-in. Please try again.');
    }

    setLoading(false);
  };

  const handleCheckOut = async () => {
    if (!searchId || searchId.length !== 8 || !/^\d{8}$/.test(searchId)) {
      Alert.alert('Validation Error', 'Please enter a valid 8-digit ID');
      return;
    }

    setLoading(true);

    try {
      const q = query(
        collection(db, 'visitors'),
        where('idNumber', '==', searchId),
        where('status', '==', 'inside')
      );
      const snapshot = await getDocs(q);

      if (snapshot.empty) {
        Alert.alert('Error', 'No active check-in found for this ID');
        setLoading(false);
        return;
      }

      const visitorDoc = snapshot.docs[0];
      await updateDoc(doc(db, 'visitors', visitorDoc.id), {
        timeOut: serverTimestamp(),
        status: 'left',
      });

      const visitorData = visitorDoc.data();
      Alert.alert('Success', `${visitorData.firstName} ${visitorData.lastName} checked out successfully!`);
      setSearchId('');

      await loadData();
    } catch (error) {
      console.error('Check-out error:', error);
      Alert.alert('Error', 'Error during check-out. Please try again.');
    }

    setLoading(false);
  };

  const formatTime = (date) => {
    if (!date) return '-';
    return new Intl.DateTimeFormat('en-KE', {
      hour: '2-digit',
      minute: '2-digit',
      day: '2-digit',
      month: 'short',
    }).format(date);
  };

  const formatDuration = (timeIn, timeOut) => {
    if (!timeIn || !timeOut) return '-';
    const diff = timeOut - timeIn;
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  };

  const renderTabButton = (tab, icon, label) => (
    <TouchableOpacity
      style={[styles.tab, activeTab === tab && styles.tabActive]}
      onPress={() => setActiveTab(tab)}
    >
      <Text style={[styles.tabIcon, activeTab === tab && styles.tabActiveText]}>
        {icon}
      </Text>
      <Text style={[styles.tabText, activeTab === tab && styles.tabActiveText]}>
        {label}
      </Text>
    </TouchableOpacity>
  );

  const renderCheckInForm = () => (
    <View style={styles.panel}>
      <View style={styles.panelHeader}>
        <Text style={styles.panelIcon}>{Icons.checkIn}</Text>
        <Text style={styles.panelTitle}>Check In Visitor</Text>
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.label}>ID Number *</Text>
        <TextInput
          style={styles.input}
          placeholder="24807965"
          placeholderTextColor="#666"
          value={formData.idNumber}
          onChangeText={(text) => setFormData({ ...formData, idNumber: text })}
          keyboardType="numeric"
          maxLength={8}
        />
        <Text style={styles.hint}>8 digits only</Text>
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.label}>Mobile Number *</Text>
        <TextInput
          style={styles.input}
          placeholder="0712345678"
          placeholderTextColor="#666"
          value={formData.mobileNumber}
          onChangeText={(text) => setFormData({ ...formData, mobileNumber: text })}
          keyboardType="phone-pad"
          maxLength={13}
        />
        <Text style={styles.hint}>e.g., 0712345678 or 254712345678</Text>
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.label}>First Name *</Text>
        <TextInput
          style={styles.input}
          placeholder="Edward"
          placeholderTextColor="#666"
          value={formData.firstName}
          onChangeText={(text) => setFormData({ ...formData, firstName: text })}
        />
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.label}>Last Name *</Text>
        <TextInput
          style={styles.input}
          placeholder="John"
          placeholderTextColor="#666"
          value={formData.lastName}
          onChangeText={(text) => setFormData({ ...formData, lastName: text })}
        />
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.label}>Car Plate (Optional)</Text>
        <TextInput
          style={styles.input}
          placeholder="KBM243T"
          placeholderTextColor="#666"
          value={formData.carPlate}
          onChangeText={(text) => setFormData({ ...formData, carPlate: text.toUpperCase() })}
          maxLength={7}
          autoCapitalize="characters"
        />
        <Text style={styles.hint}>e.g., KBM243T</Text>
      </View>

      <TouchableOpacity
        style={[styles.button, styles.buttonSuccess, loading && styles.buttonDisabled]}
        onPress={handleCheckIn}
        disabled={loading}
      >
        <Text style={styles.buttonText}>
          {loading ? 'Checking In...' : '✅ Check In Visitor'}
        </Text>
      </TouchableOpacity>
    </View>
  );

  const renderCheckOutForm = () => (
    <View style={styles.panel}>
      <View style={styles.panelHeader}>
        <Text style={styles.panelIcon}>{Icons.checkOut}</Text>
        <Text style={styles.panelTitle}>Check Out Visitor</Text>
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.label}>Enter ID Number</Text>
        <TextInput
          style={styles.input}
          placeholder="24807965"
          placeholderTextColor="#666"
          value={searchId}
          onChangeText={setSearchId}
          keyboardType="numeric"
          maxLength={8}
        />
      </View>

      <TouchableOpacity
        style={[styles.button, styles.buttonDanger, loading && styles.buttonDisabled]}
        onPress={handleCheckOut}
        disabled={loading}
      >
        <Text style={styles.buttonText}>
          {loading ? 'Checking Out...' : '⬅️ Check Out Visitor'}
        </Text>
      </TouchableOpacity>
    </View>
  );

  const renderActiveVisitors = () => (
    <View style={styles.panel}>
      <View style={styles.panelHeader}>
        <Text style={styles.panelIcon}>{Icons.users}</Text>
        <Text style={styles.panelTitle}>
          Currently Inside ({activeVisitors.length})
        </Text>
      </View>

      <ScrollView
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {activeVisitors.length === 0 ? (
          <Text style={styles.emptyText}>No visitors inside the building</Text>
        ) : (
          activeVisitors.map((visitor) => (
            <View key={visitor.id} style={styles.visitorCard}>
              <View style={styles.visitorRow}>
                <Text style={styles.visitorLabel}>Name</Text>
                <Text style={styles.visitorValue}>
                  {visitor.firstName} {visitor.lastName}
                </Text>
              </View>
              <View style={styles.visitorRow}>
                <Text style={styles.visitorLabel}>ID</Text>
                <Text style={[styles.visitorValue, styles.monoFont]}>
                  {visitor.idNumber}
                </Text>
              </View>
              <View style={styles.visitorRow}>
                <Text style={styles.visitorLabel}>Mobile</Text>
                <Text style={[styles.visitorValue, styles.monoFont]}>
                  {visitor.mobileNumber || '-'}
                </Text>
              </View>
              <View style={styles.visitorRow}>
                <Text style={styles.visitorLabel}>Time In</Text>
                <Text style={styles.visitorValue}>{formatTime(visitor.timeIn)}</Text>
              </View>
              {visitor.carPlate && (
                <View style={styles.visitorRow}>
                  <Text style={styles.visitorLabel}>Vehicle</Text>
                  <Text style={styles.visitorValue}>
                    {Icons.car} {visitor.carPlate}
                  </Text>
                </View>
              )}
              <View style={styles.statusBadgeInside}>
                <Text style={styles.statusTextInside}>INSIDE</Text>
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );

  const renderHistory = () => (
    <View style={styles.panel}>
      <View style={styles.panelHeader}>
        <Text style={styles.panelIcon}>{Icons.history}</Text>
        <Text style={styles.panelTitle}>Recent Activity</Text>
      </View>

      <ScrollView
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {recentActivity.length === 0 ? (
          <Text style={styles.emptyText}>No activity recorded yet</Text>
        ) : (
          recentActivity.map((record) => (
            <View key={record.id} style={styles.historyCard}>
              <View style={styles.historyHeader}>
                <Text style={styles.historyName}>
                  {record.firstName} {record.lastName}
                </Text>
                <View
                  style={[
                    styles.statusBadge,
                    record.status === 'inside'
                      ? styles.statusBadgeInside
                      : styles.statusBadgeLeft,
                  ]}
                >
                  <Text
                    style={[
                      styles.statusText,
                      record.status === 'inside'
                        ? styles.statusTextInside
                        : styles.statusTextLeft,
                    ]}
                  >
                    {record.status.toUpperCase()}
                  </Text>
                </View>
              </View>
              <View style={styles.historyDetails}>
                <Text style={styles.historyDetail}>ID: {record.idNumber}</Text>
                <Text style={styles.historyDetail}>Mobile: {record.mobileNumber || '-'}</Text>
                {record.carPlate && (
                  <Text style={styles.historyDetail}>
                    {Icons.car} {record.carPlate}
                  </Text>
                )}
              </View>
              <View style={styles.historyDetails}>
                <Text style={styles.historyDetail}>
                  In: {formatTime(record.timeIn)}
                </Text>
                <Text style={styles.historyDetail}>
                  Out: {formatTime(record.timeOut)}
                </Text>
                <Text style={styles.historyDetail}>
                  Duration: {formatDuration(record.timeIn, record.timeOut)}
                </Text>
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1a1a2e" />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.logo}>
            <Text style={styles.logoText}>👥</Text>
          </View>
          <View>
            <Text style={styles.headerTitle}>Gateman Security</Text>
            <Text style={styles.headerSubtitle}>Building Access Control</Text>
          </View>
        </View>
        <Text style={styles.time}>
          {new Date().toLocaleTimeString('en-KE', {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </Text>
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        {renderTabButton('checkin', Icons.checkIn, 'Check In')}
        {renderTabButton('checkout', Icons.checkOut, 'Check Out')}
        {renderTabButton('active', Icons.users, 'Inside')}
        {renderTabButton('history', Icons.history, 'History')}
      </View>

      {/* Content */}
      <ScrollView style={styles.content}>
        {activeTab === 'checkin' && renderCheckInForm()}
        {activeTab === 'checkout' && renderCheckOutForm()}
        {activeTab === 'active' && renderActiveVisitors()}
        {activeTab === 'history' && renderHistory()}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#16213e',
  },
  header: {
    backgroundColor: '#1a1a2e',
    padding: 20,
    paddingTop: Platform.OS === 'android' ? 50 : 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  logo: {
    width: 50,
    height: 50,
    borderRadius: 12,
    backgroundColor: '#ff6b6b',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoText: {
    fontSize: 24,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#a0a0a0',
    marginTop: 2,
  },
  time: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4ade80',
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: '#1a1a2e',
    padding: 8,
    gap: 8,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 8,
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  tabActive: {
    backgroundColor: '#ff6b6b',
  },
  tabIcon: {
    fontSize: 18,
    marginBottom: 4,
  },
  tabText: {
    fontSize: 11,
    color: '#a0a0a0',
    fontWeight: '600',
  },
  tabActiveText: {
    color: '#fff',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  panel: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  panelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  panelIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  panelTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  formGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#c0c0c0',
    marginBottom: 8,
  },
  input: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 10,
    padding: 14,
    fontSize: 16,
    color: '#fff',
  },
  hint: {
    fontSize: 12,
    color: '#888',
    marginTop: 4,
  },
  button: {
    padding: 16,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 10,
  },
  buttonSuccess: {
    backgroundColor: '#4ade80',
  },
  buttonDanger: {
    backgroundColor: '#f87171',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
  visitorCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  visitorRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  visitorLabel: {
    fontSize: 12,
    color: '#888',
  },
  visitorValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  monoFont: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  statusBadgeInside: {
    backgroundColor: 'rgba(74, 222, 128, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginTop: 8,
  },
  statusTextInside: {
    color: '#4ade80',
    fontSize: 11,
    fontWeight: 'bold',
  },
  statusBadgeLeft: {
    backgroundColor: 'rgba(148, 163, 184, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  statusTextLeft: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: 'bold',
  },
  historyCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  historyName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  historyDetails: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 4,
  },
  historyDetail: {
    fontSize: 12,
    color: '#a0a0a0',
  },
  emptyText: {
    textAlign: 'center',
    color: '#888',
    fontSize: 14,
    marginTop: 40,
  },
});

export default GatemanApp;
