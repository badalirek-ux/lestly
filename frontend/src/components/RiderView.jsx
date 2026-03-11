import { useState, useEffect, useRef } from 'react';
import axios from 'axios';

const API = (import.meta.env.VITE_API_URL || "http://192.168.1.85:8000") + "/api";

const STATUS_LABELS = {
  pending:    'In attesa',
  accepted:   'Accettato',
  picked_up:  'Ritirato',
  in_transit: 'In consegna',
  delivered:  'Consegnato',
  cancelled:  'Annullato'
};

const NEXT_STATUS = {
  accepted:   { status: 'picked_up',  label: '📦 Segna come Ritirato',  btn: 'btn-blue' },
  picked_up:  { status: 'in_transit', label: '🛵 Inizia la Consegna',    btn: 'btn-primary' },
  in_transit: { status: 'delivered',  label: '✅ Segna come Consegnato', btn: 'btn-green' },
};

function formatTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
}


// ── GLOBAL CHAT LISTENER per il Rider ───────────────────────────────────────
function useRiderChatListener(deliveries, onNewMessage) {
  const wsMap = useRef({});

  useEffect(() => {
    const activeIds = deliveries
      .filter(d => ['accepted','picked_up','in_transit'].includes(d.status))
      .map(d => d.deliveryId);

    Object.keys(wsMap.current).forEach(id => {
      if (!activeIds.includes(id)) {
        wsMap.current[id]?.close();
        delete wsMap.current[id];
      }
    });

    activeIds.forEach(id => {
      if (wsMap.current[id]) return;
      let destroyed = false;
      function connect() {
        if (destroyed) return;
        const ws = new WebSocket(`${(import.meta.env.VITE_WS_URL || 'ws://192.168.1.85:8000')}/ws/chat?room=${id}`);
        wsMap.current[id] = ws;
        ws.onmessage = (e) => {
          try {
            const data = JSON.parse(e.data);
            if (data.event === 'chat:message' && data.sender === 'restaurant') {
              onNewMessage(data.message, id);
            }
          } catch {}
        };
        ws.onclose = () => { if (!destroyed) setTimeout(connect, 2000); };
        ws.onerror = () => ws.close();
      }
      connect();
      wsMap.current[`${id}_destroy`] = () => { destroyed = true; };
    });

    return () => {
      Object.entries(wsMap.current).forEach(([key, val]) => {
        if (typeof val === 'function') val();
        else val?.close();
      });
      wsMap.current = {};
    };
  }, [deliveries.map(d => d.deliveryId + d.status).join(',')]);
}

// ── IN-APP TOAST NOTIFICATION ────────────────────────────────────────────────
function Toast({ message, onClose }) {
  useEffect(() => {
    const t = setTimeout(onClose, 5000);
    return () => clearTimeout(t);
  }, []);

  return (
    <div style={{
      position: 'fixed', top: 16, left: '50%', transform: 'translateX(-50%)',
      background: '#ff6b2b', color: 'white', padding: '12px 20px',
      borderRadius: 12, zIndex: 9999, fontWeight: 600, fontSize: '0.9rem',
      boxShadow: '0 4px 24px rgba(0,0,0,0.5)', maxWidth: 'calc(100vw - 32px)',
      display: 'flex', alignItems: 'center', gap: 10, animation: 'slideDown 0.3s ease'
    }}>
      🔔 {message}
      <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', fontSize: '1.1rem', marginLeft: 4 }}>✕</button>


    </div>
  );
}

// ── CHAT PANEL ───────────────────────────────────────────────────────────────
function ChatPanel({ deliveryId, sender, onNewMessage }) {
  const [messages, setMessages] = useState([]);
  const [text, setText]         = useState('');
  const bottomRef               = useRef(null);
  const isFirst                 = useRef(true);

  useEffect(() => {
    axios.get(`${API}/chat/${deliveryId}`).then(r => {
      setMessages(r.data);
      isFirst.current = false;
    }).catch(() => {});

    const ws = new WebSocket(`${(import.meta.env.VITE_WS_URL || 'ws://192.168.1.85:8000')}/ws/chat?room=${deliveryId}`);
    ws.onmessage = (e) => {
      const data = JSON.parse(e.data);
      if (data.event === 'chat:message' && data.sender !== sender) {
        setMessages(prev => [...prev, data]);
        if (!isFirst.current) onNewMessage?.(data.message);
      }
    };
    return () => ws.close();
  }, [deliveryId]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const sendMsg = async (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    try {
      await axios.post(`${API}/chat/${deliveryId}`, { sender, message: text });
      setMessages(prev => [...prev, { sender, message: text, timestamp: new Date().toISOString() }]);
      setText('');
    } catch {}
  };

  return (
    <div className="chat-window">
      <div className="chat-messages">
        {messages.length === 0 && (
          <p style={{ color: 'var(--text3)', fontSize: '0.8rem', textAlign: 'center', padding: '20px 0' }}>
            Nessun messaggio ancora
          </p>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`message-bubble ${m.sender === sender ? 'mine' : 'theirs'}`}>
            {m.message}
            <div className="message-meta">{formatTime(m.timestamp)}</div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      <form className="chat-input" onSubmit={sendMsg}>
        <input value={text} onChange={e => setText(e.target.value)} placeholder="Scrivi al ristorante..." />
        <button type="submit" className="btn btn-primary btn-sm">Invia</button>
      </form>


    </div>
  );
}

// ── AVAILABLE CARD ────────────────────────────────────────────────────────────
function AvailableCard({ order, riderId, onAccepted }) {
  const [loading, setLoading] = useState(false);

  const accept = async () => {
    setLoading(true);
    try {
      await axios.patch(`${API}/deliveries/${order.deliveryId}/accept`, { riderId });
      onAccepted();
    } catch { alert('Errore nell\'accettare l\'ordine'); }
    finally { setLoading(false); }
  };

  return (
    <div className="card" style={{ borderLeft: '3px solid var(--yellow)' }}>
      <div className="card-row">
        <div>
          <div className="card-header-row">
            <span className="card-id">{order.deliveryId}</span>
            <span className="status-badge pending">In attesa</span>
          </div>
          <div className="card-name">{order.customerName}</div>
          <a
            href={`https://maps.google.com/?q=${encodeURIComponent(order.address)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="card-detail"
            style={{ color: 'var(--blue)', textDecoration: 'none', display: 'block' }}
          >
            📍 {order.address} <span style={{ fontSize: '0.7rem', opacity: 0.7 }}>↗ Apri mappe</span>
          </a>
          <div className="card-detail">🍕 {order.orderDetails}</div>
          <div className="card-amount">€{order.totalAmount}</div>
        </div>
        <button className="btn btn-primary" onClick={accept} disabled={loading} style={{ flexShrink: 0 }}>
          {loading ? <span className="spinner" /> : '🛵 Accetta'}
        </button>
      </div>


    </div>
  );
}

// ── MY DELIVERY CARD ──────────────────────────────────────────────────────────
function MyDeliveryCard({ order, riderId, onUpdated, onNewChatMessage, unread = 0, onClearUnread }) {
  const [showChat, setShowChat] = useState(false);
  const [loading,  setLoading]  = useState(false);
  const next = NEXT_STATUS[order.status];

  const updateStatus = async () => {
    if (!next) return;
    setLoading(true);
    try {
      await axios.patch(`${API}/deliveries/${order.deliveryId}/status`, { status: next.status });
      onUpdated();
    } catch { alert('Errore aggiornamento stato'); }
    finally { setLoading(false); }
  };

  const borderColor = {
    accepted: 'var(--blue)', picked_up: '#8b5cf6',
    in_transit: 'var(--orange)', delivered: 'var(--green)'
  }[order.status] || 'var(--border)';

  return (
    <div className="card" style={{ borderLeft: `3px solid ${borderColor}` }}>
      <div className="card-row">
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="card-header-row">
            <span className="card-id">{order.deliveryId}</span>
            <span className={`status-badge ${order.status}`}>{STATUS_LABELS[order.status]}</span>
          </div>
          <div className="card-name">{order.customerName}</div>
          <a
            href={`https://maps.google.com/?q=${encodeURIComponent(order.address)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="card-detail"
            style={{ color: 'var(--blue)', textDecoration: 'none', display: 'block' }}
          >
            📍 {order.address} <span style={{ fontSize: '0.7rem', opacity: 0.7 }}>↗ Apri mappe</span>
          </a>
          <div className="card-detail">📞 {order.phone}</div>
          <div className="card-detail" style={{ color: 'var(--text3)' }}>{order.orderDetails}</div>
          <div className="card-amount">€{order.totalAmount}</div>
        </div>
      </div>

      {/* Azioni */}
      <div className="card-actions">
        {next && (
          <button className={`btn ${next.btn} btn-full`} onClick={updateStatus} disabled={loading}>
            {loading ? <span className="spinner" /> : next.label}
          </button>
        )}
        <div style={{ display: 'flex', gap: 8 }}>

          {order.status !== 'delivered' && (
            <button
              className="btn btn-sm"
              style={{
                flex: 1,
                background: unread > 0 ? '#ff6b2b' : 'var(--bg3)',
                color: unread > 0 ? 'white' : 'var(--text2)',
                border: `1px solid ${unread > 0 ? 'var(--orange)' : 'var(--border)'}`,
                fontWeight: unread > 0 ? 700 : 400,
                animation: unread > 0 ? 'pulse 1.5s infinite' : 'none',
              }}
              onClick={() => { setShowChat(s => !s); if (!showChat) onClearUnread?.(); }}
            >
              💬 {showChat ? 'Chiudi' : 'Chat'} {unread > 0 && <span style={{ background: 'white', color: '#ff6b2b', borderRadius: 100, padding: '1px 6px', fontSize: '0.7rem', marginLeft: 4 }}>{unread}</span>}
            </button>
          )}
        </div>
      </div>

      {/* Chat */}
      {showChat && (
        <div style={{ marginTop: 16, borderTop: '1px solid var(--border)', paddingTop: 16 }}>
          <div className="section-title" style={{ marginBottom: 10 }}>Chat con il Ristorante</div>
          <ChatPanel deliveryId={order.deliveryId} sender="rider" onNewMessage={onNewChatMessage} />
        </div>
      )}

      {/* Profilo / Cambio password */}
      {tab === 'profile' && (
        <ChangePasswordPanel
          endpoint={`${API}/riders/${riderId}/change-password`}
        />
      )}

    </div>
  );
}

// ── CHANGE PASSWORD PANEL ─────────────────────────────────────────────────────
function ChangePasswordPanel({ endpoint }) {
  const [form, setForm]     = useState({ oldPassword: '', newPassword: '', confirm: '' });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg]       = useState(null);

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.newPassword !== form.confirm) {
      setMsg({ ok: false, text: 'Le password non coincidono' });
      return;
    }
    if (form.newPassword.length < 4) {
      setMsg({ ok: false, text: 'La password deve essere di almeno 4 caratteri' });
      return;
    }
    setSaving(true);
    try {
      await axios.post(endpoint, {
        oldPassword: form.oldPassword,
        newPassword: form.newPassword
      });
      setMsg({ ok: true, text: 'Password aggiornata con successo!' });
      setForm({ oldPassword: '', newPassword: '', confirm: '' });
    } catch (err) {
      setMsg({ ok: false, text: err.response?.data?.detail || 'Errore nel cambio password' });
    } finally { setSaving(false); }
  };

  return (
    <div className="panel">
      <div className="section-title">🔐 Cambio Password</div>
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label>Password attuale</label>
          <input type="password" placeholder="••••••••" value={form.oldPassword} onChange={set('oldPassword')} required />
        </div>
        <div className="form-group">
          <label>Nuova password</label>
          <input type="password" placeholder="••••••••" value={form.newPassword} onChange={set('newPassword')} required />
        </div>
        <div className="form-group">
          <label>Conferma nuova password</label>
          <input type="password" placeholder="••••••••" value={form.confirm} onChange={set('confirm')} required />
        </div>
        {msg && (
          <div style={{
            padding: '10px 14px', borderRadius: 'var(--radius-sm)', marginBottom: 12,
            background: msg.ok ? 'var(--green-dim)' : 'rgba(231,76,60,0.1)',
            color: msg.ok ? 'var(--green)' : '#e74c3c',
            border: `1px solid ${msg.ok ? 'var(--green)33' : '#e74c3c33'}`
          }}>
            {msg.ok ? '✅' : '❌'} {msg.text}
          </div>
        )}
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? '⏳ Salvataggio...' : '🔐 Cambia Password'}
        </button>
      </form>
    </div>
  );
}

// ── MAIN RIDER VIEW ───────────────────────────────────────────────────────────
export default function RiderView({ riderId, riderInfo }) {
  const [available,    setAvailable]    = useState([]);
  const [isOnline,     setIsOnline]     = useState(riderInfo?.available ?? true);
  const [togglingOnline, setTogglingOnline] = useState(false);
  const [myDeliveries, setMyDeliveries] = useState([]);
  const [tab,          setTab]          = useState('available');
  const [loading,      setLoading]      = useState(true);
  const [toast,        setToast]        = useState(null);
  const prevAvailCount                  = useRef(0);

  const [unreadChats, setUnreadChats] = useState({});

  const handleNewChatMessage = (message, deliveryId) => {
    setUnreadChats(prev => ({ ...prev, [deliveryId]: (prev[deliveryId] || 0) + 1 }));
    showToast(`💬 Ristorante: "${message.slice(0, 40)}${message.length > 40 ? '...' : ''}"`);
  };

  // Global WS listener - badge anche con chat chiusa
  useRiderChatListener(myDeliveries, handleNewChatMessage);

  // Chiedi permesso notifiche al mount
  const showToast = (msg) => setToast(msg);

  const toggleOnline = async () => {
    setTogglingOnline(true);
    try {
      await axios.patch(`${API}/riders/${riderId}/availability`, { available: !isOnline });
      setIsOnline(v => !v);
    } catch { showToast('Errore nel cambio stato'); }
    finally { setTogglingOnline(false); }
  };

  const fetchData = async () => {
    try {
      const [avRes, myRes] = await Promise.all([
        axios.get(`${API}/deliveries/available`),
        axios.get(`${API}/deliveries/rider/${riderId}`)
      ]);

      // Notifica nuovo ordine disponibile
      if (avRes.data.length > prevAvailCount.current && prevAvailCount.current > 0) {
        const diff = avRes.data.length - prevAvailCount.current;
        const msg = `${diff} nuovo ordine disponibile!`;
        showToast(msg);
        notify('🛵 Lestly', msg, { tag: 'new-order' });
      }
      prevAvailCount.current = avRes.data.length;

      setAvailable(avRes.data);
      setMyDeliveries(myRes.data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 8000);
    return () => clearInterval(interval);
  }, [riderId]);

  const active    = myDeliveries.filter(d => d.status !== 'delivered');
  const completed = myDeliveries.filter(d => d.status === 'delivered');

  const stats = [
    { label: 'Disponibili', value: available.length,  color: 'var(--yellow)' },
    { label: 'In corso',    value: active.length,      color: 'var(--orange)' },
    { label: 'Consegnati',  value: completed.length,   color: 'var(--green)' },
  ];

  return (
    <div>
      {toast && <Toast message={toast} onClose={() => setToast(null)} />}

      <div className="page-title">Dashboard Rider</div>
      <div className="page-subtitle" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <span>{riderInfo?.name || riderId}</span>
        <button
          onClick={toggleOnline}
          disabled={togglingOnline}
          style={{
            padding: '8px 20px',
            borderRadius: 100,
            border: 'none',
            cursor: 'pointer',
            fontWeight: 700,
            fontSize: '0.85rem',
            fontFamily: 'Syne',
            transition: 'all 0.2s',
            background: isOnline ? 'var(--green)' : 'var(--bg3)',
            color: isOnline ? 'white' : 'var(--text3)',
            boxShadow: isOnline ? '0 0 12px rgba(39,174,96,0.4)' : 'none',
          }}
        >
          {togglingOnline ? '...' : isOnline ? '🟢 Online' : '⚫ Offline'}
        </button>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 24 }}>
        {stats.map(s => (
          <div key={s.label} className="card" style={{ padding: '14px 10px', textAlign: 'center' }}>
            <div style={{ fontSize: '1.8rem', fontWeight: 800, fontFamily: 'Syne', color: s.color }}>{s.value}</div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text3)', marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="tabs" style={{ width: '100%', marginBottom: 20 }}>
        <button className={`tab ${tab === 'available' ? 'active' : ''}`} onClick={() => setTab('available')} style={{ flex: 1 }}>
          Disponibili {available.length > 0 && <span style={{ background: 'var(--orange)', color: 'white', borderRadius: 100, padding: '1px 7px', fontSize: '0.7rem', marginLeft: 4 }}>{available.length}</span>}
        </button>
        <button className={`tab ${tab === 'active' ? 'active' : ''}`} onClick={() => setTab('active')} style={{ flex: 1 }}>
          In corso {active.length > 0 && <span style={{ background: 'var(--blue)', color: 'white', borderRadius: 100, padding: '1px 7px', fontSize: '0.7rem', marginLeft: 4 }}>{active.length}</span>}
        </button>
        <button className={`tab ${tab === 'completed' ? 'active' : ''}`} onClick={() => setTab('completed')} style={{ flex: 1 }}>
          Storico
        </button>
        <button className={`tab ${tab === 'profile' ? 'active' : ''}`} onClick={() => setTab('profile')} style={{ flex: 1 }}>
          👤 Profilo
        </button>
      </div>

      {/* Available */}
      {tab === 'available' && (
        <div>
          {loading && <div className="loading-row"><span className="spinner" /> Caricamento...</div>}
          {!loading && available.length === 0 && (
            <div className="empty-state">
              <div className="empty-icon">🕐</div>
              <p>Nessuna consegna disponibile. Riceverai una notifica appena arriva un ordine.</p>
            </div>
          )}
          {available.map(o => (
            <AvailableCard key={o.deliveryId} order={o} riderId={riderId} onAccepted={fetchData} />
          ))}
        </div>
      )}

      {/* Active */}
      {tab === 'active' && (
        <div>
          {loading && <div className="loading-row"><span className="spinner" /> Caricamento...</div>}
          {!loading && active.length === 0 && (
            <div className="empty-state">
              <div className="empty-icon">📭</div>
              <p>Nessuna consegna in corso.</p>
            </div>
          )}
          {active.map(o => (
            <MyDeliveryCard
              key={o.deliveryId}
              order={o}
              riderId={riderId}
              onUpdated={fetchData}
              onNewChatMessage={handleNewChatMessage}
              unread={unreadChats[o.deliveryId] || 0}
              onClearUnread={() => setUnreadChats(prev => ({ ...prev, [o.deliveryId]: 0 }))}
            />
          ))}
        </div>
      )}

      {/* Completed */}
      {tab === 'completed' && (
        <div>
          {completed.length === 0 && (
            <div className="empty-state"><div className="empty-icon">🏁</div><p>Nessuna consegna completata ancora</p></div>
          )}
          {completed.map(o => (
            <div key={o.deliveryId} className="card" style={{ borderLeft: '3px solid var(--green)' }}>
              <div className="card-row">
                <div>
                  <div className="card-header-row">
                    <span className="card-id">{o.deliveryId}</span>
                    <span className="status-badge delivered">Consegnato</span>
                  </div>
                  <div className="card-detail" style={{ marginTop: 4 }}>{o.customerName} — {o.address}</div>
                </div>
                <div className="card-amount">€{o.totalAmount}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Profilo / Cambio password */}
      {tab === 'profile' && (
        <ChangePasswordPanel
          endpoint={`${API}/riders/${riderId}/change-password`}
        />
      )}

    </div>
  );
}
