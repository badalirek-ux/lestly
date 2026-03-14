import { useState } from 'react';
import axios from 'axios';
import RistoranteView from './components/RistoranteView';
import RiderView from './components/RiderView';
import './App.css';

const API = (import.meta.env.VITE_API_URL || "http://192.168.1.85:8000") + "/api";
const ADMIN_KEY = import.meta.env.VITE_ADMIN_KEY || "lestly-admin-2024";


// ── ADDRESS AUTOCOMPLETE ──────────────────────────────────────────────────────
function AddressAutocomplete({ value, onChange, placeholder }) {
  const [suggestions, setSuggestions] = useState([]);
  const [showSug, setShowSug] = useState(false);
  const timerRef = useState(null);

  const handleInput = (e) => {
    const val = e.target.value;
    onChange(val);
    clearTimeout(timerRef[0]);
    if (val.length < 3) { setSuggestions([]); return; }
    timerRef[0] = setTimeout(async () => {
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=5&countrycodes=it&q=${encodeURIComponent(val)}`,
          { headers: { 'Accept-Language': 'it' } }
        );
        const data = await res.json();
        setSuggestions(data);
        setShowSug(true);
      } catch {}
    }, 400);
  };

  const pick = (item) => {
    onChange(item.display_name);
    setSuggestions([]);
    setShowSug(false);
  };

  return (
    <div style={{ position: 'relative' }}>
      <input
        placeholder={placeholder || 'Via Roma 1, Palermo'}
        value={value}
        onChange={handleInput}
        onBlur={() => setTimeout(() => setShowSug(false), 200)}
        onFocus={() => suggestions.length > 0 && setShowSug(true)}
        style={{ width: '100%' }}
      />
      {showSug && suggestions.length > 0 && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 1000,
          background: 'var(--bg3)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius-sm)', maxHeight: 200, overflowY: 'auto'
        }}>
          {suggestions.map((s, i) => (
            <div key={i} onMouseDown={() => pick(s)} style={{
              padding: '8px 12px', cursor: 'pointer', fontSize: '0.82rem',
              borderBottom: '1px solid var(--border)', color: 'var(--text)'
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--bg2)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              {s.display_name}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── SELECT SCREEN ─────────────────────────────────────────────────────────────
function SelectScreen({ onSelect }) {
  return (
    <div className="select-screen">
      <div className="hero-badge">B2B Platform</div>
      <h1 className="logo">Les<span>tly</span></h1>
      <p className="tagline">Connetti il tuo ristorante con i rider in tempo reale</p>
      <div className="role-cards">
        <button className="role-card restaurant" onClick={() => onSelect("ristorante")}>
          <div className="role-icon">🏪</div>
          <div className="role-label">Ristorante</div>
          <div className="role-desc">Gestisci ordini e consegne</div>
          <div className="role-arrow">→</div>
        </button>
        <button className="role-card rider" onClick={() => onSelect("rider")}>
          <div className="role-icon">🛵</div>
          <div className="role-label">Rider</div>
          <div className="role-desc">Accetta e consegna ordini</div>
          <div className="role-arrow">→</div>
        </button>
      </div>
      <button
        className="btn-ghost btn-sm"
        style={{ marginTop: 32, color: "var(--text3)", fontSize: "0.75rem" }}
        onClick={() => onSelect("admin")}
      >
        ⚙ Admin
      </button>
    </div>
  );
}

// ── LOGIN RISTORANTE ──────────────────────────────────────────────────────────
function LoginRistorante({ onLogin, onBack }) {
  const [restaurantId, setRestaurantId] = useState("");
  const [password, setPassword]         = useState("");
  const [error, setError]               = useState("");
  const [loading, setLoading]           = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await axios.post(`${API}/restaurants/login`, { restaurantId, password });
      onLogin(res.data.restaurantId, res.data);
    } catch (err) {
      setError(err.response?.data?.detail || "Errore di connessione");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-screen">
      <button className="btn-back" onClick={onBack}>← Indietro</button>
      <div className="login-box">
        <div className="login-icon restaurant">🏪</div>
        <h2>Accedi come Ristorante</h2>
        <p className="login-hint">Usa le credenziali fornite dall'amministratore</p>
        <form onSubmit={handleSubmit}>
          <div className="input-group">
            <label>ID Ristorante</label>
            <input placeholder="es. REST-001" value={restaurantId}
              onChange={e => { setRestaurantId(e.target.value); setError(""); }} autoFocus />
          </div>
          <div className="input-group">
            <label>Password</label>
            <input type="password" placeholder="••••••••" value={password}
              onChange={e => { setPassword(e.target.value); setError(""); }} />
          </div>
          {error && <div className="error-msg">⚠ {error}</div>}
          <button type="submit" className="btn-login restaurant" disabled={loading}>
            {loading ? <span className="spinner" /> : "Accedi"}
          </button>
        </form>
      </div>
    </div>
  );
}

// ── LOGIN RIDER ───────────────────────────────────────────────────────────────
function LoginRider({ onLogin, onBack }) {
  const [riderId, setRiderId]   = useState("");
  const [password, setPassword] = useState("");
  const [error, setError]       = useState("");
  const [loading, setLoading]   = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await axios.post(`${API}/riders/login`, { riderId, password });
      onLogin(res.data.riderId, res.data);
    } catch (err) {
      setError(err.response?.data?.detail || "Errore di connessione");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-screen">
      <button className="btn-back" onClick={onBack}>← Indietro</button>
      <div className="login-box">
        <div className="login-icon rider">🛵</div>
        <h2>Accedi come Rider</h2>
        <p className="login-hint">Usa l'ID e la password forniti dal ristorante</p>
        <form onSubmit={handleSubmit}>
          <div className="input-group">
            <label>ID Rider</label>
            <input placeholder="es. RIDER-001" value={riderId}
              onChange={e => { setRiderId(e.target.value); setError(""); }} autoFocus />
          </div>
          <div className="input-group">
            <label>Password</label>
            <input type="password" placeholder="••••••••" value={password}
              onChange={e => { setPassword(e.target.value); setError(""); }} />
          </div>
          {error && <div className="error-msg">⚠ {error}</div>}
          <button type="submit" className="btn-login rider" disabled={loading}>
            {loading ? <span className="spinner" /> : "Accedi"}
          </button>
        </form>
      </div>
    </div>
  );
}

// ── LOGIN ADMIN ───────────────────────────────────────────────────────────────
function LoginAdmin({ onLogin, onBack }) {
  const [key, setKey]     = useState("");
  const [error, setError] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    if (key === ADMIN_KEY) { onLogin(); }
    else { setError("Chiave admin non valida"); }
  };

  return (
    <div className="login-screen">
      <button className="btn-back" onClick={onBack}>← Indietro</button>
      <div className="login-box">
        <div className="login-icon" style={{ background: "var(--bg3)", fontSize: "2rem" }}>⚙</div>
        <h2>Pannello Admin</h2>
        <p className="login-hint">Inserisci la chiave di amministrazione</p>
        <form onSubmit={handleSubmit}>
          <div className="input-group">
            <label>Chiave Admin</label>
            <input type="password" placeholder="••••••••" value={key}
              onChange={e => { setKey(e.target.value); setError(""); }} autoFocus />
          </div>
          {error && <div className="error-msg">⚠ {error}</div>}
          <button type="submit" className="btn-login restaurant">Accedi</button>
        </form>
      </div>
    </div>
  );
}

// ── ADMIN PANEL ───────────────────────────────────────────────────────────────
function AdminPanel({ onLogout }) {
  const [restaurants, setRestaurants] = useState([]);
  const [loading, setLoading]         = useState(true);
  const [form, setForm]               = useState({ name: "", email: "", phone: "", address: "", password: "" });
  const [creating, setCreating]       = useState(false);
  const [newRest, setNewRest]         = useState(null);

  const fetchRestaurants = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/admin/restaurants?admin_key=${ADMIN_KEY}`);
      setRestaurants(res.data);
    } catch {}
    setLoading(false);
  };

  useState(() => { fetchRestaurants(); }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    setCreating(true);
    try {
      const res = await axios.post(`${API}/admin/restaurants?admin_key=${ADMIN_KEY}`, form);
      setNewRest(res.data);
      setForm({ name: "", email: "", phone: "", address: "", password: "" });
      fetchRestaurants();
    } catch (err) {
      alert(err.response?.data?.detail || "Errore creazione");
    }
    setCreating(false);
  };

  const [editingRest, setEditingRest] = useState(null);
  const [editForm, setEditForm]       = useState({});

  const startEdit = (r) => {
    setEditingRest(r.restaurantId);
    setEditForm({ name: r.name, email: r.email || '', phone: r.phone || '', address: r.address || '' });
  };

  const saveEdit = async (id) => {
    try {
      await axios.patch(`${API}/admin/restaurants/${id}/update?admin_key=${ADMIN_KEY}`, editForm);
      setEditingRest(null);
      fetchRestaurants();
    } catch (err) {
      alert(err.response?.data?.detail || 'Errore modifica');
    }
  };

  const setEdit = (k) => (e) => setEditForm(f => ({ ...f, [k]: e.target.value }));

  const toggleActive = async (id) => {
    await axios.patch(`${API}/admin/restaurants/${id}?admin_key=${ADMIN_KEY}`);
    fetchRestaurants();
  };

  const clearRestaurantOrders = async (id, name) => {
    if (!confirm(`⚠️ Eliminare tutti gli ordini di "${name}"? Questa azione non è reversibile.`)) return;
    try {
      await axios.delete(`${API}/deliveries/clear-restaurant/${id}?admin_key=${ADMIN_KEY}`);
      alert(`✅ Ordini di "${name}" eliminati con successo!`);
    } catch (err) {
      alert(err.response?.data?.detail || "Errore nella pulizia");
    }
  };

  const clearDeliveries = async () => {
    if (!confirm("⚠️ Sei sicuro? Verranno eliminati TUTTI gli ordini dal database. Questa azione non è reversibile.")) return;
    try {
      await axios.delete(`${API}/deliveries/clear-database`);
      alert("✅ Database ordini pulito con successo!");
    } catch (err) {
      alert(err.response?.data?.detail || "Errore nella pulizia del database");
    }
  };

  const deleteRest = async (id) => {
    if (!confirm("Eliminare il ristorante " + id + "?")) return;
    await axios.delete(`${API}/admin/restaurants/${id}?admin_key=${ADMIN_KEY}`);
    fetchRestaurants();
  };

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  return (
    <div className="app-shell">
      <header className="topbar">
        <span className="topbar-logo">Les<strong>tly</strong> <span style={{ color: "var(--text3)", fontSize: "0.75rem" }}>Admin</span></span>
        <button className="btn-logout" onClick={onLogout}>Esci</button>
      </header>
      <main className="main-content" style={{ maxWidth: 700, margin: "0 auto", padding: "24px 16px" }}>

        <div className="panel" style={{ marginBottom: 24 }}>
          <h3 style={{ marginBottom: 16 }}>➕ Nuovo Ristorante</h3>
          {newRest && (
            <div style={{ background: "var(--bg3)", border: "1px solid var(--green)", borderRadius: "var(--radius-sm)", padding: 14, marginBottom: 16 }}>
              <div style={{ color: "var(--green)", fontWeight: 700, marginBottom: 6 }}>✅ Ristorante creato!</div>
              <div style={{ fontSize: "0.85rem" }}>
                <span style={{ color: "var(--text2)" }}>ID:</span> <strong>{newRest.restaurantId}</strong>
                <span style={{ marginLeft: 16, color: "var(--text2)" }}>Nome:</span> <strong>{newRest.name}</strong>
              </div>
              <div style={{ fontSize: "0.75rem", color: "var(--text3)", marginTop: 6 }}>
                Comunica questo ID e la password al ristorante per accedere.
              </div>
              <button className="btn btn-ghost btn-sm" style={{ marginTop: 8 }} onClick={() => setNewRest(null)}>OK</button>
            </div>
          )}
          <form onSubmit={handleCreate}>
            <div className="grid-2">
              <div className="form-group">
                <label>Nome ristorante *</label>
                <input placeholder="Da Mario" value={form.name} onChange={set("name")} required />
              </div>
              <div className="form-group">
                <label>Password *</label>
                <input type="password" placeholder="••••••••" value={form.password} onChange={set("password")} required />
              </div>
            </div>
            <div className="grid-2">
              <div className="form-group">
                <label>Email</label>
                <input placeholder="mario@email.it" value={form.email} onChange={set("email")} />
              </div>
              <div className="form-group">
                <label>Telefono</label>
                <input placeholder="+39 091 000 0000" value={form.phone} onChange={set("phone")} />
              </div>
            </div>
            <div className="form-group">
              <label>Indirizzo</label>
              <AddressAutocomplete value={form.address} onChange={(v) => setForm(f => ({ ...f, address: v }))} />
            </div>
            <button type="submit" className="btn btn-primary" disabled={creating}>
              {creating ? <span className="spinner" /> : "Crea Ristorante"}
            </button>
          </form>
        </div>

        <div className="panel">
          <h3 style={{ marginBottom: 16 }}>🏪 Ristoranti ({restaurants.length})</h3>
          {loading ? (
            <div style={{ textAlign: "center", padding: 32 }}><span className="spinner" /></div>
          ) : restaurants.length === 0 ? (
            <div style={{ color: "var(--text3)", textAlign: "center", padding: 24 }}>Nessun ristorante ancora</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {restaurants.map(r => (
                <div key={r.restaurantId}>
                <div style={{
                  background: "var(--bg3)", borderRadius: "var(--radius-sm)",
                  padding: "12px 16px", display: "flex", alignItems: "center", gap: 12,
                  border: r.active ? "1px solid var(--border)" : "1px solid #e74c3c",
                  opacity: r.active ? 1 : 0.6
                }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600 }}>{r.name}</div>
                    <div style={{ fontSize: "0.75rem", color: "var(--text3)", marginTop: 2 }}>
                      ID: <strong>{r.restaurantId}</strong>
                      {r.email && " · " + r.email}
                      {r.phone && " · " + r.phone}
                    </div>
                  </div>
                  <span style={{
                    fontSize: "0.7rem", padding: "2px 8px", borderRadius: 100,
                    background: r.active ? "var(--green)" : "var(--text3)", color: "white"
                  }}>
                    {r.active ? "Attivo" : "Disattivo"}
                  </span>
                  <button className="btn btn-ghost btn-sm" onClick={() => startEdit(r)}>✏️</button>
                  <button className="btn btn-ghost btn-sm" onClick={() => toggleActive(r.restaurantId)}>
                    {r.active ? "⏸ Disattiva" : "▶ Attiva"}
                  </button>
                  <button className="btn btn-ghost btn-sm" style={{ color: "#e67e22", borderColor: "#e67e2244" }} onClick={() => clearRestaurantOrders(r.restaurantId, r.name)} title="Pulisci ordini">
                    🧹
                  </button>
                  <button className="btn btn-ghost btn-sm" style={{ color: "#e74c3c" }} onClick={() => deleteRest(r.restaurantId)}>
                    🗑
                  </button>
                </div>
                {editingRest === r.restaurantId && (
                  <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--border)" }}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label>Nome</label>
                        <input value={editForm.name} onChange={setEdit("name")} />
                      </div>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label>Telefono</label>
                        <input value={editForm.phone} onChange={setEdit("phone")} />
                      </div>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label>Email</label>
                        <input value={editForm.email} onChange={setEdit("email")} />
                      </div>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label>Indirizzo</label>
                        <AddressAutocomplete value={editForm.address} onChange={(v) => setEditForm(f => ({ ...f, address: v }))} />
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button className="btn btn-primary btn-sm" onClick={() => saveEdit(r.restaurantId)}>💾 Salva</button>
                      <button className="btn btn-ghost btn-sm" onClick={() => setEditingRest(null)}>Annulla</button>
                    </div>
                  </div>
                )}
                </div>
              ))}
            </div>
          )}
        </div>
      <div style={{ padding: "0 24px 32px" }}>
        <div style={{ borderTop: "1px solid var(--border)", paddingTop: 24, marginTop: 8 }}>
          <h3 style={{ marginBottom: 12, color: "#e74c3c" }}>⚠️ Zona Pericolosa</h3>
          <p style={{ color: "var(--text3)", fontSize: "0.85rem", marginBottom: 12 }}>
            Elimina tutti gli ordini dal database. I rider e i ristoranti non vengono eliminati.
          </p>
          <button
            className="btn btn-ghost btn-sm"
            style={{ color: "#e74c3c", borderColor: "#e74c3c44" }}
            onClick={clearDeliveries}
          >
            🗑 Pulisci tutti gli ordini
          </button>
        </div>
      </div>
      </main>
    </div>
  );
}

// ── APP ROOT ──────────────────────────────────────────────────────────────────
export default function App() {
  const [userType, setUserType]       = useState(null);
  const [userId, setUserId]           = useState(null);
  const [userInfo, setUserInfo]       = useState(null);
  const [adminLogged, setAdminLogged] = useState(false);

  const handleLogout = () => { setUserType(null); setUserId(null); setUserInfo(null); setAdminLogged(false); };

  if (userType === "admin") {
    if (!adminLogged) return <LoginAdmin onLogin={() => setAdminLogged(true)} onBack={() => setUserType(null)} />;
    return <AdminPanel onLogout={handleLogout} />;
  }

  if (!userType) return <SelectScreen onSelect={setUserType} />;

  if (!userId) {
    return userType === "ristorante"
      ? <LoginRistorante onLogin={(id, info) => { setUserId(id); setUserInfo(info); }} onBack={() => setUserType(null)} />
      : <LoginRider      onLogin={(id, info) => { setUserId(id); setUserInfo(info); }} onBack={() => setUserType(null)} />;
  }

  const displayName = userType === "ristorante"
    ? "🏪 " + (userInfo?.name || userId)
    : "🛵 " + (userInfo?.name || userId);

  return (
    <div className="app-shell">
      <header className="topbar">
        <span className="topbar-logo">Les<strong>tly</strong></span>
        <div className="topbar-right">
          <span className="topbar-role">{displayName}</span>
          <button className="btn-logout" onClick={handleLogout}>Esci</button>
        </div>
      </header>
      <main className="main-content">
        {userType === "ristorante"
          ? <RistoranteView restaurantId={userId} />
          : <RiderView riderId={userId} riderInfo={userInfo} />
        }
      </main>
    </div>
  );
}
