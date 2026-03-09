from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime
import uuid

# Delivery Models
class TrackingEvent(BaseModel):
    status: str
    time: datetime
    message: str

class DeliveryCreate(BaseModel):
    customerName: str
    phone: str
    address: str
    orderDetails: str
    totalAmount: Optional[str] = None
    restaurantId: str = "default_restaurant"

class Delivery(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    deliveryId: str
    restaurantId: str
    customerName: str
    phone: str
    address: str
    orderDetails: str
    totalAmount: Optional[str] = None
    status: str = "pending"
    riderId: Optional[str] = None
    riderName: Optional[str] = None
    riderAvatar: Optional[str] = None
    riderVehicle: Optional[str] = None
    riderRating: Optional[float] = None
    createdAt: datetime = Field(default_factory=datetime.utcnow)
    acceptedAt: Optional[datetime] = None
    pickupTime: Optional[datetime] = None
    deliveredAt: Optional[datetime] = None
    estimatedDelivery: Optional[datetime] = None
    tracking: List[TrackingEvent] = []

class DeliveryUpdate(BaseModel):
    status: str
    message: Optional[str] = None

# Message Models
class MessageCreate(BaseModel):
    sender: str  # "restaurant" or "rider"
    message: str

class Message(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    deliveryId: str
    sender: str
    message: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    read: bool = False

# Rider Models
class Rider(BaseModel):
    id: str
    name: str
    phone: str
    email: Optional[str] = None
    rating: float
    totalDeliveries: int
    vehicle: str
    available: bool
    avatar: str