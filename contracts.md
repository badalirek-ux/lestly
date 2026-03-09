# Contracts — RiderExpress v2.0

## 1. API ENDPOINTS

### Deliveries
| Method | Endpoint | Descrizione | Chi lo usa |
|--------|----------|-------------|------------|
| `POST` | `/api/deliveries` | Crea nuova consegna | Ristorante |
| `GET` | `/api/deliveries` | Tutte le consegne | Debug/Admin |
| `GET` | `/api/deliveries/available` | Consegne con status `pending` | Rider |
| `GET` | `/api/deliveries/restaurant/:restaurantId` | Consegne di un ristorante | Ristorante |
| `GET` | `/api/deliveries/rider/:riderId` | Consegne assegnate a un rider | Rider |
| `GET` | `/api/deliveries/:deliveryId` | Dettaglio singola consegna | Entrambi |
| `PATCH` | `/api/deliveries/:deliveryId/accept` | Rider accetta una consegna | Rider |
| `PATCH` | `/api/deliveries/:deliveryId/status` | Aggiorna stato consegna | Rider |
| `DELETE` | `/api/deliveries/clear-database` | Svuota il DB (solo dev) | Dev |

### Chat
| Method | Endpoint | Descrizione |
|--------|----------|-------------|
| `GET` | `/api/chat/:deliveryId` | Messaggi di una consegna |
| `POST` | `/api/chat/:deliveryId` | Invia messaggio |

### Riders
| Method | Endpoint | Descrizione |
|--------|----------|-------------|
| `GET` | `/api/riders` | Lista tutti i rider |
| `GET` | `/api/riders/:riderId` | Dettaglio rider |
| `POST` | `/api/riders` | Registra nuovo rider |
| `PATCH` | `/api/riders/:riderId/availability` | Aggiorna disponibilità |

### WebSocket
| URL | Descrizione |
|-----|-------------|
| `ws://localhost:8000/ws/chat?room=<deliveryId>` | Chat real-time per consegna |
| `ws://localhost:8000/ws/deliveries` | Aggiornamenti consegne real-time |

---

## 2. DATA MODELS

### Delivery
```json
{
  "deliveryId":        "DEL001",
  "restaurantId":      "REST-001",
  "customerName":      "Mario Rossi",
  "phone":             "+39 333 000 0000",
  "address":           "Via Roma 10, Milano",
  "orderDetails":      "2x Margherita, 1x Coca Cola",
  "totalAmount":       "24.50",
  "status":            "pending",
  "riderId":           null,
  "createdAt":         "2024-01-01T10:00:00Z",
  "acceptedAt":        null,
  "pickupTime":        null,
  "deliveredAt":       null,
  "estimatedDelivery": null,
  "tracking": [
    {
      "status":  "pending",
      "time":    "2024-01-01T10:00:00Z",
      "message": "Ordine ricevuto, in attesa di un rider"
    }
  ]
}
```

**Status flow:**
```
pending → accepted → picked_up → in_transit → delivered
                                             → cancelled
```

### Message
```json
{
  "deliveryId": "DEL001",
  "sender":     "restaurant",
  "message":    "Il cliente è al quarto piano",
  "timestamp":  "2024-01-01T10:05:00Z",
  "read":       false
}
```
`sender` può essere: `"restaurant"` oppure `"rider"`

### Rider
```json
{
  "riderId":          "RIDER-001",
  "name":             "Luca Bianchi",
  "phone":            "+39 340 111 2222",
  "email":            "luca@example.com",
  "rating":           4.8,
  "totalDeliveries":  120,
  "vehicle":          "Moto",
  "available":        true,
  "avatar":           ""
}
```
`vehicle` può essere: `"Moto"`, `"Auto"`, `"Bici"`

---

## 3. AUTENTICAZIONE (demo)

Le credenziali sono hard-coded nel frontend (`App.jsx`) per scopi demo.

| Ruolo | Password | ID assegnato |
|-------|----------|--------------|
| Ristorante | `boss123` | `REST-001` |
| Rider | `rider123` | `RIDER-001` |

> ⚠️ In produzione sostituire con JWT + MongoDB users collection.

---

## 4. WEBSOCKET EVENTS

### Chat (`/ws/chat?room=<deliveryId>`)
Payload inviato/ricevuto:
```json
{
  "event":     "chat:message",
  "sender":    "restaurant",
  "message":   "Testo del messaggio",
  "timestamp": "2024-01-01T10:00:00Z"
}
```

### Deliveries (`/ws/deliveries`)
```json
{ "event": "delivery:created",        "deliveryId": "DEL001" }
{ "event": "delivery:accepted",       "deliveryId": "DEL001", "riderId": "RIDER-001" }
{ "event": "delivery:status_updated", "deliveryId": "DEL001", "status": "in_transit" }
{ "event": "delivery:completed",      "deliveryId": "DEL001" }
```

---

## 5. STRUTTURA FILE

```
PROGETTO/
├── backend/
│   ├── main.py          # FastAPI app + WebSocket manager
│   ├── models.py        # Pydantic models (Delivery, Message, Rider)
│   ├── routes.py        # Tutti gli endpoint REST
│   ├── database.py      # Connessione MongoDB (Motor)
│   ├── requirements.txt
│   └── .env             # MONGO_URL=mongodb+srv://...
│
└── frontend/
    └── src/
        ├── App.jsx               # Auth flow + shell
        ├── App.css               # Design system completo
        ├── main.jsx
        ├── index.css
        └── components/
            ├── RistoranteView.jsx  # Dashboard ristorante
            └── RiderView.jsx       # Dashboard rider
```

---

## 6. AVVIO LOCALE

### Backend
```bash
cd backend
pip install -r requirements.txt
python main.py
# oppure: uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

### Frontend
```bash
cd frontend
npm install
npm run dev
# → http://localhost:5173
```

### .env (backend)
```
MONGO_URL=mongodb+srv://<user>:<password>@cluster.mongodb.net/riderexpress
```

---

## 7. PROSSIMI STEP (produzione)

- [ ] Autenticazione JWT con refresh token
- [ ] Registrazione rider con upload foto
- [ ] Notifiche push (FCM) per nuovi ordini
- [ ] Tracking GPS real-time via WebSocket
- [ ] Pannello admin per statistiche
- [ ] Rate limiting sulle API
- [ ] Deploy: backend su Railway/Render, frontend su Vercel
