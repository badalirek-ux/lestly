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

function formatTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
}



// ── GLOBAL CHAT LISTENER (sempre attivo, anche con chat chiusa) ──────────────
function useGlobalChatListener(deliveries, onNewMessageRef) {
  const wsMap   = useRef({});

  const depKey = deliveries.map(d => d.deliveryId).join(',');

  useEffect(() => {
    const activeIds = deliveries
      .filter(d => ['pending','accepted','picked_up','in_transit'].includes(d.status))
      .map(d => d.deliveryId);

    // Chiudi WS non più necessari
    Object.keys(wsMap.current).forEach(id => {
      if (!activeIds.includes(id)) {
        wsMap.current[id]?.destroy?.();
        delete wsMap.current[id];
      }
    });

    // Apri nuovi WS
    activeIds.forEach(id => {
      if (wsMap.current[id]) return;
      let ws, destroyed = false;

      function connect() {
        if (destroyed) return;
        ws = new WebSocket((import.meta.env.VITE_WS_URL || 'ws://192.168.1.85:8000') + '/ws/chat?room=' + id);
        ws.onopen    = () => console.log('🟢 WS connesso room:', id);
        ws.onmessage = (e) => {
          try {
            const data = JSON.parse(e.data);
            console.log('🔵 Messaggio WS:', data);
            if (data.event === 'chat:message' && data.sender === 'rider') {
              onNewMessageRef.current(data.message, id);
            }
          } catch(err) { console.error('WS error:', err); }
        };
        ws.onclose = () => { if (!destroyed) setTimeout(connect, 2000); };
        ws.onerror = () => ws.close();
      }

      connect();
      wsMap.current[id] = { destroy: () => { destroyed = true; ws?.close(); } };
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [depKey]);

  useEffect(() => () => {
    Object.values(wsMap.current).forEach(v => v?.destroy?.());
  }, []);
}

// ── TOAST ────────────────────────────────────────────────────────────────────
function Toast({ message, onClose }) {
  useEffect(() => { const t = setTimeout(onClose, 5000); return () => clearTimeout(t); }, []);
  return (
    <div style={{
      position: 'fixed', top: 16, left: '50%', transform: 'translateX(-50%)',
      background: '#3b82f6', color: 'white', padding: '12px 20px',
      borderRadius: 12, zIndex: 9999, fontWeight: 600, fontSize: '0.9rem',
      boxShadow: '0 4px 24px rgba(0,0,0,0.5)', maxWidth: 'calc(100vw - 32px)',
      display: 'flex', alignItems: 'center', gap: 10
    }}>
      🔔 {message}
      <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer' }}>✕</button>
    </div>
  );
}


// ── ADDRESS AUTOCOMPLETE (OpenStreetMap Nominatim) ───────────────────────────
function AddressAutocomplete({ value, onChange, required }) {
  const [suggestions, setSuggestions] = useState([]);
  const [showDrop, setShowDrop]       = useState(false);
  const [loading, setLoading]         = useState(false);
  const debounceRef                   = useRef(null);
  const wrapperRef                    = useRef(null);

  // Chiudi dropdown cliccando fuori
  useEffect(() => {
    function handleClick(e) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setShowDrop(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleInput = (e) => {
    const val = e.target.value;
    onChange(val);
    clearTimeout(debounceRef.current);
    if (val.length < 3) { setSuggestions([]); setShowDrop(false); return; }
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=5&countrycodes=it&q=${encodeURIComponent(val)}`,
          { headers: { 'Accept-Language': 'it' } }
        );
        const data = await res.json();
        setSuggestions(data);
        setShowDrop(data.length > 0);
      } catch { setSuggestions([]); }
      finally { setLoading(false); }
    }, 400);
  };

  const handleSelect = (item) => {
    onChange(item.display_name);
    setSuggestions([]);
    setShowDrop(false);
  };

  return (
    <div ref={wrapperRef} style={{ position: 'relative' }}>
      <div style={{ position: 'relative' }}>
        <input
          placeholder="Via Roma 10, Milano"
          value={value}
          onChange={handleInput}
          onFocus={() => suggestions.length > 0 && setShowDrop(true)}
          required={required}
          autoComplete="off"
          style={{ paddingRight: loading ? 36 : 12 }}
        />
        {loading && (
          <span style={{
            position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)'
          }}>
            <span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} />
          </span>
        )}
      </div>
      {showDrop && (
        <ul style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 999,
          background: 'var(--bg2)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius-sm)', marginTop: 4,
          listStyle: 'none', padding: 0, maxHeight: 220, overflowY: 'auto',
          boxShadow: 'var(--shadow)'
        }}>
          {suggestions.map((s, i) => (
            <li
              key={i}
              onMouseDown={() => handleSelect(s)}
              style={{
                padding: '10px 14px', cursor: 'pointer', fontSize: '0.82rem',
                color: 'var(--text)', borderBottom: '1px solid var(--border)',
                transition: 'background 0.15s'
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--bg3)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              📍 {s.display_name}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ── ORDER FORM ──────────────────────────────────────────────────────────────
function NewOrderForm({ restaurantId, onCreated }) {
  const [form, setForm] = useState({
    customerName: '', phone: '', address: '', civico: '', totalAmount: '', paymentMethod: 'contanti'
  });
  const [loading, setLoading] = useState(false);

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      // Insert civico right after street name (before first comma)
      let fullAddress = form.address;
      if (form.civico) {
        const firstComma = form.address.indexOf(',');
        if (firstComma !== -1) {
          // e.g. "Via Garibaldi, Palermo..." → "Via Garibaldi 10, Palermo..."
          fullAddress = form.address.slice(0, firstComma) + ' ' + form.civico + form.address.slice(firstComma);
        } else {
          fullAddress = form.address + ' ' + form.civico;
        }
      }
      const order = {
        deliveryId: `DEL${Date.now()}`,
        restaurantId,
        ...form,
        address: fullAddress,
        status: 'pending',
        tracking: []
      };
      await axios.post(`${API}/deliveries`, order);
      setForm({ customerName: '', phone: '', address: '', civico: '', totalAmount: '', paymentMethod: 'contanti' });
      onCreated();
    } catch (err) {
      alert('Errore nell\'invio. Controlla il backend.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="grid-2">
        <div className="form-group">
          <label>Nome cliente</label>
          <input placeholder="Mario Rossi" value={form.customerName} onChange={set('customerName')} required />
        </div>
        <div className="form-group">
          <label>Telefono</label>
          <input placeholder="+39 333 000 0000" value={form.phone} onChange={set('phone')} required />
        </div>
      </div>
      <div className="grid-2" style={{ alignItems: 'end' }}>
        <div className="form-group">
          <label>Indirizzo di consegna</label>
          <AddressAutocomplete
            value={form.address}
            onChange={(val) => setForm(f => ({ ...f, address: val }))}
            required
          />
        </div>
        <div className="form-group">
          <label>Numero civico</label>
          <input placeholder="es. 10" value={form.civico} onChange={set('civico')} />
        </div>
      </div>
      <div className="grid-2">
        <div className="form-group">
          <label>Totale (€)</label>
          <input placeholder="24.50" value={form.totalAmount} onChange={set('totalAmount')} required />
        </div>
        <div className="form-group">
          <label>Pagamento</label>
          <select value={form.paymentMethod} onChange={set('paymentMethod')} style={{ width: '100%', padding: '10px 12px', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', color: 'var(--text)', fontSize: '0.9rem' }}>
            <option value="contanti">💵 Contanti</option>
            <option value="pos">💳 POS</option>
          </select>
        </div>
      </div>
      <button type="submit" className="btn btn-primary btn-full" disabled={loading}>
        {loading ? '⏳ Invio...' : '+ Invia Ordine al Rider'}
      </button>
    </form>
  );
}

// ── CHAT PANEL ──────────────────────────────────────────────────────────────
function ChatPanel({ deliveryId, sender = 'restaurant', onNewMessage }) {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const bottomRef = useRef(null);
  const wsRef = useRef(null);

  useEffect(() => {
    axios.get(`${API}/chat/${deliveryId}`)
      .then(r => setMessages(r.data))
      .catch(() => {});

    let ws; let destroyed = false;
    function connect() {
      if (destroyed) return;
      ws = new WebSocket(`${(import.meta.env.VITE_WS_URL || 'ws://192.168.1.85:8000')}/ws/chat?room=${deliveryId}`);
      wsRef.current = ws;
      ws.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data);
          if (data.event === 'chat:message') {
            setMessages(prev => [...prev, data]);
            if (data.sender !== sender) onNewMessage?.(data.message, id);
          }
        } catch {}
      };
      ws.onclose = () => { if (!destroyed) setTimeout(connect, 2000); };
      ws.onerror = () => ws.close();
    }
    connect();
    return () => { destroyed = true; ws?.close(); };
  }, [deliveryId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

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
        <input
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="Scrivi un messaggio..."
        />
        <button type="submit" className="btn btn-primary btn-sm">Invia</button>
      </form>
    </div>
  );
}

// ── TRACKING PANEL ──────────────────────────────────────────────────────────
function TrackingPanel({ tracking }) {
  if (!tracking || tracking.length === 0)
    return <p style={{ color: 'var(--text3)', fontSize: '0.85rem' }}>Nessun evento di tracking</p>;

  return (
    <div className="timeline">
      {[...tracking].reverse().map((ev, i) => (
        <div key={i} className="timeline-item">
          <div style={{ position: 'relative' }}>
            <div className={`timeline-dot ${i === 0 ? 'active' : ''}`} />
            <div className="timeline-line" />
          </div>
          <div className="timeline-content">
            <div className="timeline-status">{STATUS_LABELS[ev.status] || ev.status}</div>
            <div className="timeline-time">{formatTime(ev.time)}</div>
            <div className="timeline-msg">{ev.message}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── ORDER CARD ──────────────────────────────────────────────────────────────
function OrderCard({ order, onRefresh, onNewChatMessage, unread = 0, onClearUnread }) {
  const [expanded, setExpanded]   = useState(null); // 'chat' | 'tracking' | 'assign' | null
  const [riders, setRiders]       = useState([]);
  const [assigning, setAssigning] = useState(false);

  const toggle = (panel) => {
    if (panel === 'assign' && expanded !== 'assign') {
      axios.get(`${API}/riders`).then(r => setRiders(r.data.filter(rd => rd.available && rd.active !== false)));
    }
    setExpanded(prev => prev === panel ? null : panel);
  };

  const assignRider = async (riderId) => {
    setAssigning(true);
    try {
      await axios.patch(`${API}/deliveries/${order.deliveryId}/accept`, { riderId });
      setExpanded(null);
      onRefresh();
    } catch (err) {
      alert(err.response?.data?.detail || 'Errore assegnazione');
    } finally { setAssigning(false); }
  };

  return (
    <div className="card" style={{ borderLeft: `3px solid ${order.status === 'delivered' ? 'var(--green)' : order.status === 'in_transit' ? 'var(--orange)' : order.status === 'accepted' ? 'var(--blue)' : 'var(--border)'}` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <span style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: '0.9rem' }}>{order.deliveryId}</span>
            <span className={`status-badge ${order.status}`}>{STATUS_LABELS[order.status]}</span>
          </div>
          <div style={{ color: 'var(--text)', fontWeight: 500, marginBottom: 2 }}>{order.customerName}</div>
          <div style={{ color: 'var(--text2)', fontSize: '0.82rem' }}>📍 {order.address}</div>
          <div style={{ color: 'var(--text3)', fontSize: '0.8rem', marginTop: 2 }}>
            <strong style={{ color: 'var(--text2)' }}>€{order.totalAmount}</strong> · {order.paymentMethod === 'pos' ? '💳 POS' : '💵 Contanti'}
          </div>
          <div style={{ color: 'var(--text3)', fontSize: '0.75rem', marginTop: 4 }}>
            Creato alle {formatTime(order.createdAt)}
            {order.riderId && ` · Rider: ${order.riderId}`}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {order.status === 'pending' && (
            <button className="btn btn-primary btn-sm" onClick={() => toggle('assign')}>
              🛵 Assegna Rider
            </button>
          )}
          <button className="btn btn-ghost btn-sm" onClick={() => toggle('tracking')}>
            {expanded === 'tracking' ? '▲' : '▼'} Tracking
          </button>
          {['accepted','picked_up','in_transit'].includes(order.status) && (
            <button
              className="btn btn-sm"
              style={{
                background: unread > 0 ? '#ff6b2b' : 'var(--bg3)',
                color: unread > 0 ? 'white' : 'var(--text2)',
                border: `1px solid ${unread > 0 ? 'var(--orange)' : 'var(--border)'}`,
                fontWeight: unread > 0 ? 700 : 400,
                animation: unread > 0 ? 'pulse 1.5s infinite' : 'none',
              }}
              onClick={() => { toggle('chat'); if (expanded !== 'chat') onClearUnread?.(); }}
            >
              💬 Chat {unread > 0 && <span style={{ background: 'white', color: '#ff6b2b', borderRadius: 100, padding: '1px 6px', fontSize: '0.7rem', marginLeft: 4 }}>{unread}</span>}
            </button>
          )}
        </div>
      </div>

      {expanded === 'assign' && (
        <div style={{ marginTop: 16, borderTop: '1px solid var(--border)', paddingTop: 16 }}>
          <div className="section-title" style={{ marginBottom: 12 }}>Scegli Rider</div>
          {riders.length === 0 ? (
            <div style={{ color: 'var(--text3)', fontSize: '0.85rem' }}>Nessun rider disponibile al momento</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {riders.map(r => (
                <div key={r.riderId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg3)', padding: '10px 14px', borderRadius: 'var(--radius-sm)' }}>
                  <div>
                    <span style={{ fontWeight: 600 }}>{r.name}</span>
                    <span style={{ color: 'var(--text3)', fontSize: '0.78rem', marginLeft: 8 }}>{r.riderId} · {r.vehicle}</span>
                  </div>
                  <button className="btn btn-primary btn-sm" disabled={assigning} onClick={() => assignRider(r.riderId)}>
                    {assigning ? '...' : 'Assegna'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {expanded === 'tracking' && (
        <div style={{ marginTop: 20, borderTop: '1px solid var(--border)', paddingTop: 16 }}>
          <div className="section-title" style={{ marginBottom: 12 }}>Storico Tracking</div>
          <TrackingPanel tracking={order.tracking} />
        </div>
      )}

      {expanded === 'chat' && (
        <div style={{ marginTop: 20, borderTop: '1px solid var(--border)', paddingTop: 16 }}>
          <div className="section-title" style={{ marginBottom: 12 }}>Chat con il Rider</div>
          <ChatPanel deliveryId={order.deliveryId} sender="restaurant" onNewMessage={onNewChatMessage} />
        </div>
      )}
    </div>
  );
}

// ── RIDER MANAGEMENT ────────────────────────────────────────────────────────
function RiderManagement() {
  const [riders, setRiders]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', phone: '', vehicle: 'Moto', password: '' });
  const [saving, setSaving]   = useState(false);

  const fetchRiders = async () => {
    try {
      const res = await axios.get(`${API}/riders`);
      setRiders(res.data);
    } catch {} finally { setLoading(false); }
  };

  useEffect(() => {
    fetchRiders();
    const interval = setInterval(fetchRiders, 8000);
    return () => clearInterval(interval);
  }, []);

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  const handleCreate = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const riderId = `RIDER-${Date.now()}`;
      await axios.post(`${API}/riders`, {
        riderId,
        name:     form.name,
        phone:    form.phone,
        email:    '',
        password: form.password,
        vehicle:  form.vehicle,
        available: true,
        rating: 5.0,
        totalDeliveries: 0,
        avatar: ''
      });
      setForm({ name: '', phone: '', vehicle: 'Moto', password: '' });
      setShowForm(false);
      fetchRiders();
    } catch (err) {
      alert(err.response?.data?.detail || 'Errore nella creazione rider');
    } finally { setSaving(false); }
  };

  const toggleAvailability = async (rider) => {
    try {
      await axios.patch(`${API}/riders/${rider.riderId}/active`);
      fetchRiders();
    } catch {}
  };

  const deleteRider = async (riderId) => {
    if (!confirm(`Eliminare il rider ${riderId}?`)) return;
    try {
      await axios.delete(`${API}/riders/${riderId}`);
      fetchRiders();
    } catch {}
  };

  const [editingRider, setEditingRider] = useState(null);
  const [editForm, setEditForm]         = useState({});

  const startEdit = (r) => {
    setEditingRider(r.riderId);
    setEditForm({ name: r.name, phone: r.phone, vehicle: r.vehicle });
  };

  const saveEdit = async (riderId) => {
    try {
      await axios.patch(`${API}/riders/${riderId}`, editForm);
      setEditingRider(null);
      fetchRiders();
    } catch (err) {
      alert(err.response?.data?.detail || 'Errore modifica');
    }
  };

  const setEdit = (k) => (e) => setEditForm(f => ({ ...f, [k]: e.target.value }));

  const VEHICLE_ICON = { Moto: '🛵', Auto: '🚗', Bici: '🚲' };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div className="section-title" style={{ margin: 0 }}>Team Rider ({riders.length})</div>
        <button className="btn btn-primary btn-sm" onClick={() => setShowForm(s => !s)}>
          {showForm ? '✕ Annulla' : '+ Aggiungi Rider'}
        </button>
      </div>

      {/* Form nuovo rider */}
      {showForm && (
        <div className="panel" style={{ marginBottom: 20 }}>
          <div className="section-title">Nuovo Rider</div>
          <form onSubmit={handleCreate}>
            <div className="grid-2">
              <div className="form-group">
                <label>Nome completo</label>
                <input placeholder="Luca Bianchi" value={form.name} onChange={set('name')} required />
              </div>
              <div className="form-group">
                <label>Telefono</label>
                <input placeholder="+39 340 000 0000" value={form.phone} onChange={set('phone')} required />
              </div>
            </div>
            <div className="grid-2">
              <div className="form-group">
                <label>Veicolo</label>
                <select value={form.vehicle} onChange={set('vehicle')}>
                  <option value="Moto">🛵 Moto</option>
                  <option value="Auto">🚗 Auto</option>
                  <option value="Bici">🚲 Bici</option>
                </select>
              </div>
              <div className="form-group">
                <label>Password accesso</label>
                <input type="password" placeholder="Scegli una password" value={form.password} onChange={set('password')} required />
              </div>
            </div>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? '⏳ Creazione...' : '✓ Crea Rider'}
            </button>
          </form>
        </div>
      )}

      {/* Lista rider */}
      {loading && <div className="loading-row"><span className="spinner" /> Caricamento...</div>}
      {!loading && riders.length === 0 && (
        <div className="empty-state">
          <div className="empty-icon">👥</div>
          <p>Nessun rider registrato. Aggiungine uno!</p>
        </div>
      )}
      {riders.map(r => (
        <div key={r.riderId} className="card" style={{
          borderLeft: `3px solid ${r.available ? 'var(--green)' : 'var(--border)'}`,
          opacity: r.available ? 1 : 0.6
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                <span style={{ fontSize: '1.3rem' }}>{VEHICLE_ICON[r.vehicle] || '🛵'}</span>
                <span style={{ fontFamily: 'Syne', fontWeight: 700 }}>{r.name}</span>
                <span style={{
                  fontSize: '0.72rem', fontWeight: 600, padding: '2px 8px', borderRadius: 100,
                  background: r.available ? 'var(--green-dim)' : 'var(--bg3)',
                  color: r.available ? 'var(--green)' : 'var(--text3)',
                  border: `1px solid ${r.available ? 'var(--green)33' : 'var(--border)'}`
                }}>
                  {r.available ? 'Disponibile' : 'Non disponibile'}
                </span>
              </div>
              <div style={{ color: 'var(--text2)', fontSize: '0.82rem' }}>📞 {r.phone}</div>
              <div style={{ color: 'var(--text3)', fontSize: '0.75rem', marginTop: 2 }}>
                ID: {r.riderId} · {r.vehicle} · ⭐ {r.rating} · {r.totalDeliveries} consegne
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-sm btn-ghost" onClick={() => startEdit(r)}>✏️ Modifica</button>
              <button
                className={`btn btn-sm ${r.active === false ? 'btn-green' : 'btn-ghost'}`}
                onClick={() => toggleAvailability(r)}
                title={r.active === false ? 'Riattiva rider' : 'Disattiva rider (non lavora più)'}
              >
                {r.active === false ? '▶ Riattiva' : '⏸ Disattiva'}
              </button>
              <button
                className="btn btn-sm btn-ghost"
                style={{ color: 'var(--red)', borderColor: 'var(--red)22' }}
                onClick={() => deleteRider(r.riderId)}
              >
                🗑
              </button>
            </div>
          </div>
          {editingRider === r.riderId && (
            <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
              <div className="grid-2" style={{ marginBottom: 8 }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label>Nome</label>
                  <input value={editForm.name} onChange={setEdit('name')} />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label>Telefono</label>
                  <input value={editForm.phone} onChange={setEdit('phone')} />
                </div>
              </div>
              <div className="form-group" style={{ marginBottom: 8 }}>
                <label>Veicolo</label>
                <select value={editForm.vehicle} onChange={setEdit('vehicle')}>
                  <option value="Moto">🛵 Moto</option>
                  <option value="Auto">🚗 Auto</option>
                  <option value="Bici">🚲 Bici</option>
                </select>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-primary btn-sm" onClick={() => saveEdit(r.riderId)}>💾 Salva</button>
                <button className="btn btn-ghost btn-sm" onClick={() => setEditingRider(null)}>Annulla</button>
              </div>
            </div>
          )}
        </div>
      ))}
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

export default function RistoranteView({ restaurantId }) {
  const [deliveries, setDeliveries] = useState([]);
  const [tab, setTab]               = useState('active');
  const [dateFrom, setDateFrom]         = useState('');
  const [dateTo, setDateTo]             = useState('');
  const [riderFilter, setRiderFilter]   = useState('');
  const [paymentFilter, setPaymentFilter] = useState('');
  const [allRiders, setAllRiders]       = useState([]);
  const [loading, setLoading]       = useState(true);
  const [toast, setToast]           = useState(null);
  const [unreadChats, setUnreadChats] = useState({});

  const fetchOrders = async () => {
    try {
      const res = await axios.get(`${API}/deliveries/restaurant/${restaurantId}`);
      setDeliveries(res.data);
    } catch {
      // nessun fallback - ogni ristorante vede solo i propri ordini
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
    axios.get(`${API}/riders`).then(r => setAllRiders(r.data)).catch(() => {});
    const interval = setInterval(fetchOrders, 10000);
    return () => clearInterval(interval);
  }, [restaurantId]);

  // Refs stabili per evitare stale closure e WS duplicati
  const setUnreadRef = useRef(setUnreadChats);
  const setToastRef  = useRef(setToast);
  setUnreadRef.current = setUnreadChats;
  setToastRef.current  = setToast;

  const onChatMsgRef = useRef((message, deliveryId) => {
    setUnreadRef.current(prev => ({ ...prev, [deliveryId]: (prev[deliveryId] || 0) + 1 }));
    setToastRef.current(`💬 Rider: "${message.slice(0, 40)}${message.length > 40 ? '...' : ''}"`);
  });

  useGlobalChatListener(deliveries, onChatMsgRef);

  const active    = deliveries.filter(d => !['delivered','cancelled'].includes(d.status));
  const completed = deliveries.filter(d => d.status === 'delivered');

  const stats = [
    { label: 'Totali', value: deliveries.length, color: 'var(--text2)' },
    { label: 'Attivi',   value: active.length,    color: 'var(--orange)' },
    { label: 'Consegnati', value: completed.length, color: 'var(--green)' },
  ];

  return (
    <div>
      {toast && <Toast message={toast} onClose={() => setToast(null)} />}
      <div className="page-title">Dashboard Ristorante</div>
      <div className="page-subtitle">ID: {restaurantId}</div>

      {/* Stats */}
      <div className="grid-2" style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginBottom: 28 }}>
        {stats.map(s => (
          <div key={s.label} className="card" style={{ padding: '16px 20px', textAlign: 'center' }}>
            <div style={{ fontSize: '2rem', fontWeight: 800, fontFamily: 'Syne', color: s.color }}>{s.value}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text3)', marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="tabs">
        <button className={`tab ${tab === 'new' ? 'active' : ''}`} onClick={() => setTab('new')}>+ Nuovo Ordine</button>
        <button className={`tab ${tab === 'active' ? 'active' : ''}`} onClick={() => setTab('active')}>Attivi ({active.length})</button>
        <button className={`tab ${tab === 'all' ? 'active' : ''}`} onClick={() => setTab('all')}>📋 Storico</button>
        <button className={`tab ${tab === 'riders' ? 'active' : ''}`} onClick={() => setTab('riders')}>👥 Rider</button>
        <button className={`tab ${tab === 'profile' ? 'active' : ''}`} onClick={() => setTab('profile')}>👤 Profilo</button>
      </div>

      {/* New order */}
      {tab === 'new' && (
        <div className="panel">
          <div className="section-title">Nuovo Ordine</div>
          <NewOrderForm restaurantId={restaurantId} onCreated={() => { fetchOrders(); setTab('active'); }} />
        </div>
      )}

      {/* Active orders */}
      {tab === 'active' && (
        <div>
          {loading && <div className="loading-row"><span className="spinner" /> Caricamento...</div>}
          {!loading && active.length === 0 && (
            <div className="empty-state">
              <div className="empty-icon">✅</div>
              <p>Nessun ordine attivo. <button className="btn btn-ghost btn-sm" style={{ marginLeft: 8 }} onClick={() => setTab('new')}>Crea il primo</button></p>
            </div>
          )}
          {active.map(o => <OrderCard key={o.deliveryId} order={o} onRefresh={fetchOrders} onNewChatMessage={(msg, id) => onChatMsgRef.current(msg, id)} unread={unreadChats[o.deliveryId] || 0} onClearUnread={() => setUnreadChats(prev => ({ ...prev, [o.deliveryId]: 0 }))} />)}
        </div>
      )}

      {/* Storico con filtri */}
      {tab === 'all' && (() => {
        const filtered = deliveries.filter(o => {
          const d = new Date(o.createdAt);
          if (dateFrom && d < new Date(dateFrom)) return false;
          if (dateTo   && d > new Date(dateTo + 'T23:59:59')) return false;
          if (riderFilter && o.riderId !== riderFilter) return false;
          if (paymentFilter && o.paymentMethod !== paymentFilter) return false;
          return true;
        });
        // Lista rider unici dagli ordini
        const riderMap = Object.fromEntries(allRiders.map(r => [r.riderId, r.name]));
        const riderOptions = [...new Map(
          deliveries.filter(o => o.riderId).map(o => [o.riderId, {
            id: o.riderId,
            name: (riderMap[o.riderId] || o.riderName)
              ? `${riderMap[o.riderId] || o.riderName} · ${o.riderId}`
              : o.riderId
          }])
        ).values()];
        const totale = filtered.reduce((sum, o) => sum + parseFloat(o.totalAmount || 0), 0);
        const consegnati = filtered.filter(o => o.status === 'delivered').length;
        return (
          <div>
            {/* Filtri */}
            <div className="panel" style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                <div className="form-group" style={{ margin: 0, flex: 1, minWidth: 140 }}>
                  <label>Dal</label>
                  <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
                </div>
                <div className="form-group" style={{ margin: 0, flex: 1, minWidth: 140 }}>
                  <label>Al</label>
                  <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} />
                </div>
                <div className="form-group" style={{ margin: 0, flex: 1, minWidth: 140 }}>
                  <label>Rider</label>
                  <select value={riderFilter} onChange={e => setRiderFilter(e.target.value)} style={{ width: '100%', padding: '10px 12px', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', color: 'var(--text)', fontSize: '0.9rem' }}>
                    <option value="">Tutti i rider</option>
                    {riderOptions.map(r => (
                      <option key={r.id} value={r.id}>{r.name}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group" style={{ margin: 0, flex: 1, minWidth: 140 }}>
                  <label>Pagamento</label>
                  <select value={paymentFilter} onChange={e => setPaymentFilter(e.target.value)} style={{ width: '100%', padding: '10px 12px', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', color: 'var(--text)', fontSize: '0.9rem' }}>
                    <option value="">Tutti</option>
                    <option value="contanti">💵 Contanti</option>
                    <option value="pos">💳 POS</option>
                  </select>
                </div>
                <button className="btn btn-ghost btn-sm" onClick={() => { setDateFrom(''); setDateTo(''); setRiderFilter(''); setPaymentFilter(''); }}>Reset</button>
              </div>
              {/* Riepilogo */}
              <div style={{ display: 'flex', gap: 16, marginTop: 12, flexWrap: 'wrap' }}>
                <div style={{ background: 'var(--bg3)', borderRadius: 'var(--radius-sm)', padding: '8px 16px', fontSize: '0.85rem' }}>
                  <span style={{ color: 'var(--text3)' }}>Ordini </span>
                  <strong>{filtered.length}</strong>
                </div>
                <div style={{ background: 'var(--bg3)', borderRadius: 'var(--radius-sm)', padding: '8px 16px', fontSize: '0.85rem' }}>
                  <span style={{ color: 'var(--text3)' }}>Consegnati </span>
                  <strong style={{ color: 'var(--green)' }}>{consegnati}</strong>
                </div>
                <div style={{ background: 'var(--bg3)', borderRadius: 'var(--radius-sm)', padding: '8px 16px', fontSize: '0.85rem' }}>
                  <span style={{ color: 'var(--text3)' }}>Totale </span>
                  <strong style={{ color: 'var(--orange)' }}>€{totale.toFixed(2)}</strong>
                </div>
                <div style={{ background: 'var(--bg3)', borderRadius: 'var(--radius-sm)', padding: '8px 16px', fontSize: '0.85rem' }}>
                  <span style={{ color: 'var(--text3)' }}>💵 </span>
                  <strong>€{filtered.filter(o => o.paymentMethod !== 'pos').reduce((s, o) => s + parseFloat(o.totalAmount || 0), 0).toFixed(2)}</strong>
                </div>
                <div style={{ background: 'var(--bg3)', borderRadius: 'var(--radius-sm)', padding: '8px 16px', fontSize: '0.85rem' }}>
                  <span style={{ color: 'var(--text3)' }}>💳 </span>
                  <strong>€{filtered.filter(o => o.paymentMethod === 'pos').reduce((s, o) => s + parseFloat(o.totalAmount || 0), 0).toFixed(2)}</strong>
                </div>
              </div>
            </div>
            {loading && <div className="loading-row"><span className="spinner" /> Caricamento...</div>}
            {!loading && filtered.length === 0 && (
              <div className="empty-state"><div className="empty-icon">📦</div><p>Nessun ordine nel periodo selezionato</p></div>
            )}
            {filtered.map(o => <OrderCard key={o.deliveryId} order={o} onRefresh={fetchOrders} onNewChatMessage={(msg, id) => onChatMsgRef.current(msg, id)} unread={unreadChats[o.deliveryId] || 0} onClearUnread={() => setUnreadChats(prev => ({ ...prev, [o.deliveryId]: 0 }))} />)}
          </div>
        );
      })()}

      {/* Riders management */}
      {tab === 'riders' && (
        <div className="panel">
          <RiderManagement />
        </div>
      )}

      {/* Profilo */}
      {tab === 'profile' && (
        <ChangePasswordPanel endpoint={`${API}/restaurants/${restaurantId}/change-password`} />
      )}

    </div>
  );
}
