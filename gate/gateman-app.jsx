import React, { useState, useEffect } from 'react';
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
  Timestamp
} from 'firebase/firestore';
import { Search, LogIn, LogOut, Users, Car, Clock, ChevronDown } from 'lucide-react';

// Initialize Firebase (Replace with your config)
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

const GatemanApp = () => {
  const [activeTab, setActiveTab] = useState('checkin');
  const [formData, setFormData] = useState({
    idNumber: '',
    firstName: '',
    lastName: '',
    carPlate: ''
  });
  const [searchId, setSearchId] = useState('');
  const [activeVisitors, setActiveVisitors] = useState([]);
  const [recentActivity, setRecentActivity] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });
  const [showConfig, setShowConfig] = useState(false);

  // Load active visitors and recent activity
  useEffect(() => {
    loadActiveVisitors();
    loadRecentActivity();
  }, []);

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
        timeIn: doc.data().timeIn?.toDate()
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
      const activities = snapshot.docs.slice(0, 20).map(doc => ({
        id: doc.id,
        ...doc.data(),
        timeIn: doc.data().timeIn?.toDate(),
        timeOut: doc.data().timeOut?.toDate()
      }));
      setRecentActivity(activities);
    } catch (error) {
      console.error('Error loading activity:', error);
    }
  };

  const validateForm = () => {
    const { idNumber, firstName, lastName } = formData;
    
    if (!idNumber || idNumber.length !== 8 || !/^\d{8}$/.test(idNumber)) {
      showMessage('ID must be exactly 8 digits', 'error');
      return false;
    }
    
    if (!firstName.trim() || !lastName.trim()) {
      showMessage('First name and last name are required', 'error');
      return false;
    }
    
    if (formData.carPlate && !/^[A-Z]{3}\d{3}[A-Z]$/i.test(formData.carPlate.toUpperCase())) {
      showMessage('Car plate must be in Kenyan format (e.g., KBM243T)', 'error');
      return false;
    }
    
    return true;
  };

  const handleCheckIn = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) return;
    
    setLoading(true);
    
    try {
      // Check if person is already inside
      const q = query(
        collection(db, 'visitors'),
        where('idNumber', '==', formData.idNumber),
        where('status', '==', 'inside')
      );
      const snapshot = await getDocs(q);
      
      if (!snapshot.empty) {
        showMessage('This person is already checked in!', 'error');
        setLoading(false);
        return;
      }
      
      // Add new check-in record
      await addDoc(collection(db, 'visitors'), {
        idNumber: formData.idNumber,
        firstName: formData.firstName.trim(),
        lastName: formData.lastName.trim(),
        carPlate: formData.carPlate.toUpperCase().trim() || null,
        timeIn: serverTimestamp(),
        timeOut: null,
        status: 'inside',
        createdAt: serverTimestamp()
      });
      
      showMessage(`${formData.firstName} ${formData.lastName} checked in successfully!`, 'success');
      setFormData({ idNumber: '', firstName: '', lastName: '', carPlate: '' });
      
      // Reload data
      await loadActiveVisitors();
      await loadRecentActivity();
      
    } catch (error) {
      console.error('Check-in error:', error);
      showMessage('Error during check-in. Please try again.', 'error');
    }
    
    setLoading(false);
  };

  const handleCheckOut = async () => {
    if (!searchId || searchId.length !== 8 || !/^\d{8}$/.test(searchId)) {
      showMessage('Please enter a valid 8-digit ID', 'error');
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
        showMessage('No active check-in found for this ID', 'error');
        setLoading(false);
        return;
      }
      
      // Update the most recent check-in
      const visitorDoc = snapshot.docs[0];
      await updateDoc(doc(db, 'visitors', visitorDoc.id), {
        timeOut: serverTimestamp(),
        status: 'left'
      });
      
      const visitorData = visitorDoc.data();
      showMessage(`${visitorData.firstName} ${visitorData.lastName} checked out successfully!`, 'success');
      setSearchId('');
      
      // Reload data
      await loadActiveVisitors();
      await loadRecentActivity();
      
    } catch (error) {
      console.error('Check-out error:', error);
      showMessage('Error during check-out. Please try again.', 'error');
    }
    
    setLoading(false);
  };

  const showMessage = (text, type) => {
    setMessage({ text, type });
    setTimeout(() => setMessage({ text: '', type: '' }), 5000);
  };

  const formatTime = (date) => {
    if (!date) return '-';
    return new Intl.DateTimeFormat('en-KE', {
      hour: '2-digit',
      minute: '2-digit',
      day: '2-digit',
      month: 'short'
    }).format(date);
  };

  const formatDuration = (timeIn, timeOut) => {
    if (!timeIn || !timeOut) return '-';
    const diff = timeOut - timeIn;
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
      fontFamily: "'Plus Jakarta Sans', -apple-system, sans-serif",
      color: '#e8e8e8',
      padding: '20px'
    }}>
      {/* Header */}
      <div style={{
        maxWidth: '1200px',
        margin: '0 auto 30px',
        background: 'rgba(255, 255, 255, 0.03)',
        borderRadius: '16px',
        padding: '24px 32px',
        backdropFilter: 'blur(10px)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{
              width: '56px',
              height: '56px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #ff6b6b 0%, #ee5a6f 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 20px rgba(255, 107, 107, 0.3)'
            }}>
              <Users size={28} color="#fff" />
            </div>
            <div>
              <h1 style={{ 
                margin: 0, 
                fontSize: '28px', 
                fontWeight: '700',
                background: 'linear-gradient(135deg, #fff 0%, #a8a8a8 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                letterSpacing: '-0.5px'
              }}>
                Gateman Security
              </h1>
              <p style={{ margin: '4px 0 0', color: '#a0a0a0', fontSize: '14px' }}>
                Building Access Control System
              </p>
            </div>
          </div>
          <div style={{
            background: 'rgba(255, 255, 255, 0.05)',
            padding: '12px 20px',
            borderRadius: '10px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px'
          }}>
            <Clock size={18} color="#4ade80" />
            <span style={{ fontSize: '15px', fontWeight: '600' }}>
              {new Date().toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        </div>
      </div>

      {/* Message Alert */}
      {message.text && (
        <div style={{
          maxWidth: '1200px',
          margin: '0 auto 20px',
          padding: '16px 24px',
          borderRadius: '12px',
          background: message.type === 'success' 
            ? 'rgba(74, 222, 128, 0.1)' 
            : 'rgba(248, 113, 113, 0.1)',
          border: `1px solid ${message.type === 'success' ? '#4ade80' : '#f87171'}`,
          color: message.type === 'success' ? '#4ade80' : '#f87171',
          fontWeight: '500',
          fontSize: '15px',
          animation: 'slideIn 0.3s ease-out'
        }}>
          {message.text}
        </div>
      )}

      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        {/* Tab Navigation */}
        <div style={{
          display: 'flex',
          gap: '12px',
          marginBottom: '24px',
          background: 'rgba(255, 255, 255, 0.03)',
          padding: '8px',
          borderRadius: '12px',
          border: '1px solid rgba(255, 255, 255, 0.08)'
        }}>
          {[
            { id: 'checkin', label: 'Check In', icon: LogIn },
            { id: 'checkout', label: 'Check Out', icon: LogOut },
            { id: 'active', label: 'Inside Now', icon: Users },
            { id: 'history', label: 'History', icon: Clock }
          ].map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  flex: 1,
                  padding: '14px 20px',
                  background: activeTab === tab.id 
                    ? 'linear-gradient(135deg, #ff6b6b 0%, #ee5a6f 100%)'
                    : 'transparent',
                  color: activeTab === tab.id ? '#fff' : '#a0a0a0',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '15px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'all 0.3s ease',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  boxShadow: activeTab === tab.id ? '0 4px 20px rgba(255, 107, 107, 0.3)' : 'none'
                }}
              >
                <Icon size={18} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Check In Form */}
        {activeTab === 'checkin' && (
          <div style={{
            background: 'rgba(255, 255, 255, 0.03)',
            borderRadius: '16px',
            padding: '32px',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            backdropFilter: 'blur(10px)'
          }}>
            <h2 style={{ 
              margin: '0 0 24px', 
              fontSize: '22px', 
              fontWeight: '700',
              display: 'flex',
              alignItems: 'center',
              gap: '12px'
            }}>
              <LogIn size={24} color="#4ade80" />
              Check In Visitor
            </h2>
            
            <form onSubmit={handleCheckIn}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
                <div>
                  <label style={{ 
                    display: 'block', 
                    marginBottom: '8px', 
                    fontSize: '14px', 
                    fontWeight: '600',
                    color: '#c0c0c0'
                  }}>
                    ID Number *
                  </label>
                  <input
                    type="text"
                    value={formData.idNumber}
                    onChange={(e) => setFormData({...formData, idNumber: e.target.value})}
                    placeholder="24807965"
                    maxLength="8"
                    style={{
                      width: '100%',
                      padding: '14px 16px',
                      background: 'rgba(255, 255, 255, 0.05)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      borderRadius: '10px',
                      color: '#fff',
                      fontSize: '15px',
                      outline: 'none',
                      transition: 'all 0.3s ease',
                      boxSizing: 'border-box'
                    }}
                    onFocus={(e) => e.target.style.borderColor = '#ff6b6b'}
                    onBlur={(e) => e.target.style.borderColor = 'rgba(255, 255, 255, 0.1)'}
                  />
                  <small style={{ color: '#888', fontSize: '12px', marginTop: '4px', display: 'block' }}>
                    8 digits only
                  </small>
                </div>

                <div>
                  <label style={{ 
                    display: 'block', 
                    marginBottom: '8px', 
                    fontSize: '14px', 
                    fontWeight: '600',
                    color: '#c0c0c0'
                  }}>
                    First Name *
                  </label>
                  <input
                    type="text"
                    value={formData.firstName}
                    onChange={(e) => setFormData({...formData, firstName: e.target.value})}
                    placeholder="Edward"
                    style={{
                      width: '100%',
                      padding: '14px 16px',
                      background: 'rgba(255, 255, 255, 0.05)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      borderRadius: '10px',
                      color: '#fff',
                      fontSize: '15px',
                      outline: 'none',
                      transition: 'all 0.3s ease',
                      boxSizing: 'border-box'
                    }}
                    onFocus={(e) => e.target.style.borderColor = '#ff6b6b'}
                    onBlur={(e) => e.target.style.borderColor = 'rgba(255, 255, 255, 0.1)'}
                  />
                </div>

                <div>
                  <label style={{ 
                    display: 'block', 
                    marginBottom: '8px', 
                    fontSize: '14px', 
                    fontWeight: '600',
                    color: '#c0c0c0'
                  }}>
                    Last Name *
                  </label>
                  <input
                    type="text"
                    value={formData.lastName}
                    onChange={(e) => setFormData({...formData, lastName: e.target.value})}
                    placeholder="John"
                    style={{
                      width: '100%',
                      padding: '14px 16px',
                      background: 'rgba(255, 255, 255, 0.05)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      borderRadius: '10px',
                      color: '#fff',
                      fontSize: '15px',
                      outline: 'none',
                      transition: 'all 0.3s ease',
                      boxSizing: 'border-box'
                    }}
                    onFocus={(e) => e.target.style.borderColor = '#ff6b6b'}
                    onBlur={(e) => e.target.style.borderColor = 'rgba(255, 255, 255, 0.1)'}
                  />
                </div>

                <div>
                  <label style={{ 
                    display: 'block', 
                    marginBottom: '8px', 
                    fontSize: '14px', 
                    fontWeight: '600',
                    color: '#c0c0c0'
                  }}>
                    Car Plate (Optional)
                  </label>
                  <input
                    type="text"
                    value={formData.carPlate}
                    onChange={(e) => setFormData({...formData, carPlate: e.target.value.toUpperCase()})}
                    placeholder="KBM243T"
                    maxLength="7"
                    style={{
                      width: '100%',
                      padding: '14px 16px',
                      background: 'rgba(255, 255, 255, 0.05)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      borderRadius: '10px',
                      color: '#fff',
                      fontSize: '15px',
                      outline: 'none',
                      transition: 'all 0.3s ease',
                      boxSizing: 'border-box'
                    }}
                    onFocus={(e) => e.target.style.borderColor = '#ff6b6b'}
                    onBlur={(e) => e.target.style.borderColor = 'rgba(255, 255, 255, 0.1)'}
                  />
                  <small style={{ color: '#888', fontSize: '12px', marginTop: '4px', display: 'block' }}>
                    e.g., KBM243T
                  </small>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                style={{
                  width: '100%',
                  padding: '16px',
                  background: loading 
                    ? 'rgba(255, 255, 255, 0.1)' 
                    : 'linear-gradient(135deg, #4ade80 0%, #22c55e 100%)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '10px',
                  fontSize: '16px',
                  fontWeight: '700',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  transition: 'all 0.3s ease',
                  boxShadow: loading ? 'none' : '0 4px 20px rgba(74, 222, 128, 0.3)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '10px'
                }}
              >
                <LogIn size={20} />
                {loading ? 'Checking In...' : 'Check In Visitor'}
              </button>
            </form>
          </div>
        )}

        {/* Check Out */}
        {activeTab === 'checkout' && (
          <div style={{
            background: 'rgba(255, 255, 255, 0.03)',
            borderRadius: '16px',
            padding: '32px',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            backdropFilter: 'blur(10px)'
          }}>
            <h2 style={{ 
              margin: '0 0 24px', 
              fontSize: '22px', 
              fontWeight: '700',
              display: 'flex',
              alignItems: 'center',
              gap: '12px'
            }}>
              <LogOut size={24} color="#f87171" />
              Check Out Visitor
            </h2>
            
            <div style={{ marginBottom: '20px' }}>
              <label style={{ 
                display: 'block', 
                marginBottom: '8px', 
                fontSize: '14px', 
                fontWeight: '600',
                color: '#c0c0c0'
              }}>
                Enter ID Number
              </label>
              <input
                type="text"
                value={searchId}
                onChange={(e) => setSearchId(e.target.value)}
                placeholder="24807965"
                maxLength="8"
                style={{
                  width: '100%',
                  padding: '14px 16px',
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '10px',
                  color: '#fff',
                  fontSize: '15px',
                  outline: 'none',
                  transition: 'all 0.3s ease',
                  boxSizing: 'border-box'
                }}
                onFocus={(e) => e.target.style.borderColor = '#f87171'}
                onBlur={(e) => e.target.style.borderColor = 'rgba(255, 255, 255, 0.1)'}
              />
            </div>

            <button
              onClick={handleCheckOut}
              disabled={loading}
              style={{
                width: '100%',
                padding: '16px',
                background: loading 
                  ? 'rgba(255, 255, 255, 0.1)' 
                  : 'linear-gradient(135deg, #f87171 0%, #ef4444 100%)',
                color: '#fff',
                border: 'none',
                borderRadius: '10px',
                fontSize: '16px',
                fontWeight: '700',
                cursor: loading ? 'not-allowed' : 'pointer',
                transition: 'all 0.3s ease',
                boxShadow: loading ? 'none' : '0 4px 20px rgba(248, 113, 113, 0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '10px'
              }}
            >
              <LogOut size={20} />
              {loading ? 'Checking Out...' : 'Check Out Visitor'}
            </button>
          </div>
        )}

        {/* Active Visitors */}
        {activeTab === 'active' && (
          <div style={{
            background: 'rgba(255, 255, 255, 0.03)',
            borderRadius: '16px',
            padding: '32px',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            backdropFilter: 'blur(10px)'
          }}>
            <h2 style={{ 
              margin: '0 0 24px', 
              fontSize: '22px', 
              fontWeight: '700',
              display: 'flex',
              alignItems: 'center',
              gap: '12px'
            }}>
              <Users size={24} color="#60a5fa" />
              Currently Inside ({activeVisitors.length})
            </h2>
            
            {activeVisitors.length === 0 ? (
              <div style={{ 
                textAlign: 'center', 
                padding: '40px', 
                color: '#888',
                fontSize: '15px'
              }}>
                No visitors inside the building
              </div>
            ) : (
              <div style={{ display: 'grid', gap: '12px' }}>
                {activeVisitors.map(visitor => (
                  <div
                    key={visitor.id}
                    style={{
                      background: 'rgba(255, 255, 255, 0.05)',
                      padding: '20px',
                      borderRadius: '12px',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr 1fr auto',
                      gap: '20px',
                      alignItems: 'center'
                    }}
                  >
                    <div>
                      <div style={{ fontSize: '12px', color: '#888', marginBottom: '4px' }}>Name</div>
                      <div style={{ fontSize: '16px', fontWeight: '600' }}>
                        {visitor.firstName} {visitor.lastName}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: '12px', color: '#888', marginBottom: '4px' }}>ID Number</div>
                      <div style={{ fontSize: '16px', fontWeight: '600', fontFamily: 'monospace' }}>
                        {visitor.idNumber}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: '12px', color: '#888', marginBottom: '4px' }}>
                        {visitor.carPlate ? 'Vehicle' : 'Time In'}
                      </div>
                      <div style={{ 
                        fontSize: '16px', 
                        fontWeight: '600',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                      }}>
                        {visitor.carPlate ? (
                          <>
                            <Car size={16} color="#fbbf24" />
                            {visitor.carPlate}
                          </>
                        ) : (
                          formatTime(visitor.timeIn)
                        )}
                      </div>
                    </div>
                    <div style={{
                      background: 'rgba(74, 222, 128, 0.1)',
                      padding: '8px 16px',
                      borderRadius: '8px',
                      fontSize: '13px',
                      fontWeight: '600',
                      color: '#4ade80'
                    }}>
                      INSIDE
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* History */}
        {activeTab === 'history' && (
          <div style={{
            background: 'rgba(255, 255, 255, 0.03)',
            borderRadius: '16px',
            padding: '32px',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            backdropFilter: 'blur(10px)'
          }}>
            <h2 style={{ 
              margin: '0 0 24px', 
              fontSize: '22px', 
              fontWeight: '700',
              display: 'flex',
              alignItems: 'center',
              gap: '12px'
            }}>
              <Clock size={24} color="#a78bfa" />
              Recent Activity
            </h2>
            
            {recentActivity.length === 0 ? (
              <div style={{ 
                textAlign: 'center', 
                padding: '40px', 
                color: '#888',
                fontSize: '15px'
              }}>
                No activity recorded yet
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }}>
                      <th style={{ padding: '12px', textAlign: 'left', fontSize: '13px', fontWeight: '600', color: '#888' }}>ID</th>
                      <th style={{ padding: '12px', textAlign: 'left', fontSize: '13px', fontWeight: '600', color: '#888' }}>Name</th>
                      <th style={{ padding: '12px', textAlign: 'left', fontSize: '13px', fontWeight: '600', color: '#888' }}>Vehicle</th>
                      <th style={{ padding: '12px', textAlign: 'left', fontSize: '13px', fontWeight: '600', color: '#888' }}>Time In</th>
                      <th style={{ padding: '12px', textAlign: 'left', fontSize: '13px', fontWeight: '600', color: '#888' }}>Time Out</th>
                      <th style={{ padding: '12px', textAlign: 'left', fontSize: '13px', fontWeight: '600', color: '#888' }}>Duration</th>
                      <th style={{ padding: '12px', textAlign: 'left', fontSize: '13px', fontWeight: '600', color: '#888' }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentActivity.map(record => (
                      <tr key={record.id} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                        <td style={{ padding: '16px 12px', fontSize: '14px', fontFamily: 'monospace' }}>
                          {record.idNumber}
                        </td>
                        <td style={{ padding: '16px 12px', fontSize: '14px', fontWeight: '500' }}>
                          {record.firstName} {record.lastName}
                        </td>
                        <td style={{ padding: '16px 12px', fontSize: '14px' }}>
                          {record.carPlate || '-'}
                        </td>
                        <td style={{ padding: '16px 12px', fontSize: '14px' }}>
                          {formatTime(record.timeIn)}
                        </td>
                        <td style={{ padding: '16px 12px', fontSize: '14px' }}>
                          {formatTime(record.timeOut)}
                        </td>
                        <td style={{ padding: '16px 12px', fontSize: '14px' }}>
                          {formatDuration(record.timeIn, record.timeOut)}
                        </td>
                        <td style={{ padding: '16px 12px' }}>
                          <span style={{
                            background: record.status === 'inside' 
                              ? 'rgba(74, 222, 128, 0.1)' 
                              : 'rgba(148, 163, 184, 0.1)',
                            color: record.status === 'inside' ? '#4ade80' : '#94a3b8',
                            padding: '6px 12px',
                            borderRadius: '6px',
                            fontSize: '12px',
                            fontWeight: '600',
                            textTransform: 'uppercase'
                          }}>
                            {record.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Firebase Config Notice */}
      <div style={{
        position: 'fixed',
        bottom: '20px',
        right: '20px',
        background: 'rgba(251, 191, 36, 0.1)',
        border: '1px solid #fbbf24',
        borderRadius: '12px',
        padding: '16px 20px',
        maxWidth: '300px',
        backdropFilter: 'blur(10px)',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)'
      }}>
        <div style={{ fontSize: '13px', color: '#fbbf24', fontWeight: '600', marginBottom: '4px' }}>
          ⚠️ Configuration Required
        </div>
        <div style={{ fontSize: '12px', color: '#d4d4d4', lineHeight: '1.5' }}>
          Replace Firebase config in the code with your project credentials to enable database functionality.
        </div>
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap');
        
        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        input::placeholder {
          color: #666;
        }

        button:hover:not(:disabled) {
          transform: translateY(-2px);
        }

        button:active:not(:disabled) {
          transform: translateY(0);
        }
      `}</style>
    </div>
  );
};

export default GatemanApp;
