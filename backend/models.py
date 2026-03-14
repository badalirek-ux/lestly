from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime


# ─── TRACKING EVENT ───────────────────────────────────────────────────────────
class TrackingEvent(BaseModel):
    status: str
    time: datetime = Field(default_factory=datetime.utcnow)
    message: str


# ─── DELIVERY ─────────────────────────────────────────────────────────────────
class Delivery(BaseModel):
    deliveryId: str
    restaurantId: str
    customerName: str
    phone: str
    address: str
    orderDetails: str = ""
    paymentMethod: str = "contanti"
    totalAmount: str
    status: str = "pending"  # pending | accepted | picked_up | in_transit | delivered | cancelled
    riderId: Optional[str] = None
    createdAt: datetime = Field(default_factory=datetime.utcnow)
    acceptedAt: Optional[datetime] = None
    pickupTime: Optional[datetime] = None
    deliveredAt: Optional[datetime] = None
    estimatedDelivery: Optional[datetime] = None
    tracking: List[TrackingEvent] = []


class UpdateStatus(BaseModel):
    status: str


class AcceptDelivery(BaseModel):
    riderId: str


# ─── MESSAGE ──────────────────────────────────────────────────────────────────
class Message(BaseModel):
    deliveryId: str
    sender: str  # "restaurant" | "rider"
    message: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    read: bool = False


class SendMessage(BaseModel):
    sender: str
    message: str


# ─── RIDER ────────────────────────────────────────────────────────────────────
class Rider(BaseModel):
    riderId: str
    name: str
    phone: str
    email: str = ""
    password: str = ""          # salvata in chiaro (demo) — in prod usare hash
    rating: float = 5.0
    totalDeliveries: int = 0
    vehicle: str = "Moto"       # "Moto" | "Auto" | "Bici"
    available: bool = True
    active: bool = True
    avatar: str = ""


class UpdateAvailability(BaseModel):
    available: bool


class RiderLogin(BaseModel):
    riderId: str
    password: str


# ─── RESTAURANT ───────────────────────────────────────────────────────────────
class Restaurant(BaseModel):
    restaurantId: str
    name: str
    email: str = ""
    phone: str = ""
    address: str = ""
    password: str
    active: bool = True
    createdAt: datetime = Field(default_factory=datetime.utcnow)


class RestaurantLogin(BaseModel):
    restaurantId: str
    password: str


class CreateRestaurant(BaseModel):
    name: str
    email: str = ""
    phone: str = ""
    address: str = ""
    password: str
