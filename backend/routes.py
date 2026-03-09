from fastapi import APIRouter, HTTPException, Query
import bcrypt
import bcrypt
from typing import List
from datetime import datetime
from pydantic import BaseModel
from models import (
    Delivery, UpdateStatus, AcceptDelivery,
    Message, SendMessage,
    Rider, UpdateAvailability, RiderLogin,
    Restaurant, RestaurantLogin, CreateRestaurant
)
from database import deliveries_collection, messages_collection, riders_collection, restaurants_collection
from ws_manager import manager
import os


# ─── PASSWORD HELPERS ─────────────────────────────────────────────────────────
def hash_password(plain: str) -> str:
    return bcrypt.hashpw(plain.encode(), bcrypt.gensalt()).decode()

def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode(), hashed.encode())
    except Exception:
        # Fallback per password in chiaro già nel DB (migrazione)
        return plain == hashed


router = APIRouter()


# ═══════════════════════════════════════════════════════════════
#  DELIVERIES
# ═══════════════════════════════════════════════════════════════

@router.post("/deliveries", response_model=Delivery)
async def create_delivery(delivery: Delivery):
    """Ristorante crea una nuova consegna."""
    data = delivery.model_dump()
    # Primo evento tracking
    data["tracking"] = [{
        "status": "pending",
        "time": datetime.utcnow(),
        "message": "Ordine ricevuto, in attesa di un rider"
    }]
    result = await deliveries_collection.insert_one(data)
    if not result.inserted_id:
        raise HTTPException(status_code=500, detail="Errore nel salvataggio")
    return delivery


@router.get("/deliveries", response_model=List[Delivery])
async def get_all_deliveries():
    """Tutte le consegne (admin/debug)."""
    docs = []
    async for doc in deliveries_collection.find():
        doc.pop("_id", None)
        docs.append(doc)
    return docs


@router.get("/deliveries/available", response_model=List[Delivery])
async def get_available_deliveries():
    """Consegne disponibili per i rider (status = pending)."""
    docs = []
    async for doc in deliveries_collection.find({"status": "pending"}):
        doc.pop("_id", None)
        docs.append(doc)
    return docs


@router.get("/deliveries/restaurant/{restaurant_id}", response_model=List[Delivery])
async def get_deliveries_by_restaurant(restaurant_id: str):
    """Tutte le consegne di un ristorante."""
    docs = []
    async for doc in deliveries_collection.find({"restaurantId": restaurant_id}):
        doc.pop("_id", None)
        docs.append(doc)
    return docs


@router.get("/deliveries/rider/{rider_id}", response_model=List[Delivery])
async def get_deliveries_by_rider(rider_id: str):
    """Consegne assegnate a un rider."""
    docs = []
    async for doc in deliveries_collection.find({"riderId": rider_id}):
        doc.pop("_id", None)
        docs.append(doc)
    return docs


@router.get("/deliveries/{delivery_id}", response_model=Delivery)
async def get_delivery(delivery_id: str):
    """Dettaglio singola consegna."""
    doc = await deliveries_collection.find_one({"deliveryId": delivery_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Consegna non trovata")
    doc.pop("_id", None)
    return doc


@router.patch("/deliveries/{delivery_id}/accept")
async def accept_delivery(delivery_id: str, data: AcceptDelivery):
    """Rider accetta una consegna."""
    tracking_event = {
        "status": "accepted",
        "time": datetime.utcnow(),
        "message": f"Consegna accettata dal rider {data.riderId}"
    }
    result = await deliveries_collection.update_one(
        {"deliveryId": delivery_id, "status": "pending"},
        {"$set": {
            "status": "accepted",
            "riderId": data.riderId,
            "acceptedAt": datetime.utcnow()
        },
        "$push": {"tracking": tracking_event}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Consegna non trovata o già accettata")
    return {"message": "Consegna accettata"}


@router.patch("/deliveries/{delivery_id}/status")
async def update_delivery_status(delivery_id: str, data: UpdateStatus):
    """Aggiorna lo stato di una consegna con tracking."""
    messages_map = {
        "picked_up":   "Ordine ritirato dal rider",
        "in_transit":  "Ordine in consegna",
        "delivered":   "Ordine consegnato con successo",
        "cancelled":   "Consegna annullata"
    }
    tracking_event = {
        "status": data.status,
        "time": datetime.utcnow(),
        "message": messages_map.get(data.status, f"Stato aggiornato: {data.status}")
    }
    extra = {}
    if data.status == "picked_up":
        extra["pickupTime"] = datetime.utcnow()
    elif data.status == "delivered":
        extra["deliveredAt"] = datetime.utcnow()

    result = await deliveries_collection.update_one(
        {"deliveryId": delivery_id},
        {"$set": {"status": data.status, **extra},
         "$push": {"tracking": tracking_event}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Consegna non trovata")
    return {"message": "Stato aggiornato"}


@router.delete("/deliveries/clear-database")
async def clear_database():
    result = await deliveries_collection.delete_many({})
    return {"message": f"Eliminati {result.deleted_count} ordini"}


# ═══════════════════════════════════════════════════════════════
#  CHAT
# ═══════════════════════════════════════════════════════════════

@router.get("/chat/{delivery_id}", response_model=List[Message])
async def get_messages(delivery_id: str):
    """Messaggi di una consegna."""
    docs = []
    async for doc in messages_collection.find({"deliveryId": delivery_id}).sort("timestamp", 1):
        doc.pop("_id", None)
        docs.append(doc)
    return docs


@router.post("/chat/{delivery_id}", response_model=Message)
async def send_message(delivery_id: str, data: SendMessage):
    """Invia messaggio in una chat e fa broadcast WebSocket."""
    msg = Message(
        deliveryId=delivery_id,
        sender=data.sender,
        message=data.message
    )
    await messages_collection.insert_one(msg.model_dump())

    # Broadcast a tutti i client connessi nella room
    await manager.broadcast(delivery_id, {
        "event":     "chat:message",
        "sender":    data.sender,
        "message":   data.message,
        "deliveryId": delivery_id,
        "timestamp": msg.timestamp.isoformat()
    })

    return msg


# ═══════════════════════════════════════════════════════════════
#  RIDERS
# ═══════════════════════════════════════════════════════════════

class RiderLogin(BaseModel):
    riderId: str
    password: str

# IMPORTANTE: /riders/login deve stare PRIMA di /riders/{rider_id}
@router.post("/riders/login")
async def rider_login(data: RiderLogin):
    """Il rider fa login con il suo ID e password."""
    doc = await riders_collection.find_one({"riderId": data.riderId})
    if not doc:
        raise HTTPException(status_code=404, detail="Rider non trovato")
    stored = doc.get("password", "")
    # Supporta sia password in chiaro (vecchi record) che hashate
    try:
        valid = bcrypt.checkpw(data.password.encode(), stored.encode())
    except Exception:
        valid = (stored == data.password)  # fallback per record non hashati
    if not valid:
        raise HTTPException(status_code=401, detail="Password errata")
    doc.pop("_id", None)
    doc.pop("password", None)
    return doc


@router.post("/riders", response_model=Rider)
async def create_rider(rider: Rider):
    """Registra un nuovo rider (chiamato dal ristorante)."""
    existing = await riders_collection.find_one({"riderId": rider.riderId})
    if existing:
        raise HTTPException(status_code=400, detail="ID rider già esistente")
    data = rider.model_dump()
    # Hash della password prima di salvare
    if data.get("password"):
        hashed = bcrypt.hashpw(data["password"].encode(), bcrypt.gensalt())
        data["password"] = hashed.decode()
    await riders_collection.insert_one(data)
    return rider


@router.get("/riders", response_model=List[Rider])
async def get_riders():
    docs = []
    async for doc in riders_collection.find():
        doc.pop("_id", None)
        docs.append(doc)
    return docs


@router.get("/riders/{rider_id}", response_model=Rider)
async def get_rider(rider_id: str):
    doc = await riders_collection.find_one({"riderId": rider_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Rider non trovato")
    doc.pop("_id", None)
    return doc


@router.patch("/riders/{rider_id}")
async def update_rider(rider_id: str, data: dict):
    """Aggiorna i dati di un rider (nome, telefono, veicolo)."""
    allowed = {k: v for k, v in data.items() if k in ["name", "phone", "vehicle", "email"]}
    if not allowed:
        raise HTTPException(status_code=400, detail="Nessun campo valido")
    await riders_collection.update_one({"riderId": rider_id}, {"$set": allowed})
    return {"message": "Rider aggiornato"}


@router.patch("/riders/{rider_id}/availability")
async def update_rider_availability(rider_id: str, data: UpdateAvailability):
    result = await riders_collection.update_one(
        {"riderId": rider_id},
        {"$set": {"available": data.available}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Rider non trovato")
    return {"message": "Disponibilità aggiornata"}


@router.delete("/riders/{rider_id}")
async def delete_rider(rider_id: str):
    result = await riders_collection.delete_one({"riderId": rider_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Rider non trovato")
    return {"message": "Rider eliminato"}


# ═══════════════════════════════════════════════════════════════
#  GPS TRACKING
# ═══════════════════════════════════════════════════════════════

class GpsPosition(BaseModel):
    riderId: str
    lat: float
    lng: float

# In-memory store per le posizioni GPS (veloce, non serve persistenza)
rider_positions: dict = {}

@router.post("/gps/update")
async def update_gps(data: GpsPosition):
    """Il rider aggiorna la sua posizione GPS."""
    rider_positions[data.riderId] = {
        "lat": data.lat,
        "lng": data.lng,
        "updatedAt": datetime.utcnow().isoformat()
    }
    return {"ok": True}

@router.get("/gps/riders")
async def get_all_gps():
    """Il ristorante legge la posizione di tutti i rider attivi."""
    return rider_positions

@router.get("/gps/rider/{rider_id}")
async def get_rider_gps(rider_id: str):
    """Posizione di un singolo rider."""
    pos = rider_positions.get(rider_id)
    if not pos:
        raise HTTPException(status_code=404, detail="Posizione non disponibile")
    return pos


# ─── MIGRAZIONE PASSWORD IN CHIARO → HASH ────────────────────────────────────
@router.post("/riders/{rider_id}/set-password")
async def set_rider_password(rider_id: str, data: RiderLogin):
    """Aggiorna la password di un rider esistente con versione hashata."""
    hashed = hash_password(data.password)
    result = await riders_collection.update_one(
        {"riderId": rider_id},
        {"$set": {"password": hashed}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Rider non trovato")
    return {"message": "Password aggiornata"}


# ═══════════════════════════════════════════════════════════════
#  RESTAURANTS
# ═══════════════════════════════════════════════════════════════

ADMIN_KEY = os.getenv("ADMIN_KEY", "lestly-admin-2024")

def check_admin(key: str):
    if key != ADMIN_KEY:
        raise HTTPException(status_code=403, detail="Chiave admin non valida")


@router.post("/restaurants/login")
async def restaurant_login(data: RestaurantLogin):
    """Login ristorante."""
    doc = await restaurants_collection.find_one({"restaurantId": data.restaurantId})
    if not doc:
        raise HTTPException(status_code=404, detail="Ristorante non trovato")
    if not doc.get("active", True):
        raise HTTPException(status_code=403, detail="Account disattivato")
    if not verify_password(data.password, doc.get("password", "")):
        raise HTTPException(status_code=401, detail="Password errata")
    return {
        "restaurantId": doc["restaurantId"],
        "name":         doc["name"],
        "email":        doc.get("email", ""),
        "phone":        doc.get("phone", ""),
    }


@router.get("/admin/restaurants")
async def list_restaurants(admin_key: str = ""):
    """Lista tutti i ristoranti (solo admin)."""
    check_admin(admin_key)
    docs = await restaurants_collection.find({}, {"_id": 0, "password": 0}).to_list(100)
    return docs


@router.post("/admin/restaurants")
async def create_restaurant(data: CreateRestaurant, admin_key: str = ""):
    """Crea un nuovo ristorante (solo admin)."""
    check_admin(admin_key)
    # Genera ID automatico
    count = await restaurants_collection.count_documents({})
    restaurant_id = f"REST-{str(count + 1).zfill(3)}"
    existing = await restaurants_collection.find_one({"restaurantId": restaurant_id})
    if existing:
        restaurant_id = f"REST-{str(count + 100).zfill(3)}"

    restaurant = Restaurant(
        restaurantId=restaurant_id,
        name=data.name,
        email=data.email,
        phone=data.phone,
        address=data.address,
        password=hash_password(data.password)
    )
    await restaurants_collection.insert_one(restaurant.model_dump())
    return {"restaurantId": restaurant_id, "name": data.name, "message": "Ristorante creato"}


@router.patch("/admin/restaurants/{restaurant_id}/update")
async def update_restaurant(restaurant_id: str, data: dict, admin_key: str = Query(...)):
    if admin_key != ADMIN_KEY:
        raise HTTPException(status_code=403, detail="Non autorizzato")
    allowed = {k: v for k, v in data.items() if k in ["name", "phone", "email", "address"]}
    if not allowed:
        raise HTTPException(status_code=400, detail="Nessun campo valido")
    await restaurants_collection.update_one({"restaurantId": restaurant_id}, {"$set": allowed})
    return {"message": "Ristorante aggiornato"}


@router.patch("/admin/restaurants/{restaurant_id}")
async def toggle_restaurant(restaurant_id: str, admin_key: str = ""):
    """Attiva o disattiva un ristorante."""
    check_admin(admin_key)
    doc = await restaurants_collection.find_one({"restaurantId": restaurant_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Ristorante non trovato")
    new_status = not doc.get("active", True)
    await restaurants_collection.update_one(
        {"restaurantId": restaurant_id},
        {"$set": {"active": new_status}}
    )
    return {"active": new_status}


@router.delete("/admin/restaurants/{restaurant_id}")
async def delete_restaurant(restaurant_id: str, admin_key: str = ""):
    """Elimina un ristorante."""
    check_admin(admin_key)
    await restaurants_collection.delete_one({"restaurantId": restaurant_id})
    return {"message": "Ristorante eliminato"}


# ═══════════════════════════════════════════════════════════════
#  GEOCODING PROXY (evita CORS con Nominatim dal browser)
# ═══════════════════════════════════════════════════════════════
import httpx

@router.get("/geocode")
async def geocode(q: str):
    """Proxy per Nominatim — evita blocchi CORS dal browser."""
    async with httpx.AsyncClient() as client:
        res = await client.get(
            "https://nominatim.openstreetmap.org/search",
            params={"format": "json", "addressdetails": "1", "limit": "5", "countrycodes": "it", "q": q},
            headers={"User-Agent": "Lestly/1.0", "Accept-Language": "it"},
            timeout=5
        )
        return res.json()
