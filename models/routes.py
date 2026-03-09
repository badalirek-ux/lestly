from fastapi import APIRouter, HTTPException
from typing import List
from models import (
    Delivery, DeliveryCreate, DeliveryUpdate,
    Message, MessageCreate,
    Rider, TrackingEvent
)
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime, timedelta
import os
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api")

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

deliveries_collection = db.deliveries
messages_collection = db.messages
riders_collection = db.riders

# Utility functions
def generate_delivery_id():
    import random
    return f"DEL{random.randint(100, 999)}"

def calculate_estimated_delivery():
    return datetime.utcnow() + timedelta(minutes=30)

# Initialize sample riders if not exists
async def init_sample_riders():
    count = await riders_collection.count_documents({})
    if count == 0:
        sample_riders = [
            {
                "id": "rider1",
                "name": "Marco Rossi",
                "phone": "+39 333 1234567",
                "email": "marco.rossi@email.com",
                "rating": 4.8,
                "totalDeliveries": 342,
                "vehicle": "Moto",
                "available": True,
                "avatar": "https://api.dicebear.com/7.x/avataaars/svg?seed=Marco"
            },
            {
                "id": "rider2",
                "name": "Giulia Bianchi",
                "phone": "+39 340 9876543",
                "email": "giulia.bianchi@email.com",
                "rating": 4.9,
                "totalDeliveries": 521,
                "vehicle": "Auto",
                "available": True,
                "avatar": "https://api.dicebear.com/7.x/avataaars/svg?seed=Giulia"
            },
            {
                "id": "rider3",
                "name": "Luca Ferrari",
                "phone": "+39 349 5551234",
                "email": "luca.ferrari@email.com",
                "rating": 4.7,
                "totalDeliveries": 289,
                "vehicle": "Bici",
                "available": True,
                "avatar": "https://api.dicebear.com/7.x/avataaars/svg?seed=Luca"
            }
        ]
        await riders_collection.insert_many(sample_riders)
        logger.info(f"Initialized {len(sample_riders)} sample riders")

# Deliveries Endpoints
@router.post("/deliveries", response_model=Delivery)
async def create_delivery(delivery_data: DeliveryCreate):
    try:
        delivery_dict = delivery_data.dict()
        delivery_dict["deliveryId"] = generate_delivery_id()
        delivery_dict["status"] = "pending"
        delivery_dict["createdAt"] = datetime.utcnow()
        delivery_dict["tracking"] = [
            {
                "status": "created",
                "time": datetime.utcnow(),
                "message": "Ordine creato"
            },
            {
                "status": "pending",
                "time": datetime.utcnow(),
                "message": "In attesa di rider"
            }
        ]
        
        result = await deliveries_collection.insert_one(delivery_dict)
        delivery_dict["id"] = str(result.inserted_id)
        
        logger.info(f"Created delivery: {delivery_dict['deliveryId']}")
        return Delivery(**delivery_dict)
    except Exception as e:
        logger.error(f"Error creating delivery: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/deliveries", response_model=List[Delivery])
async def get_all_deliveries():
    try:
        deliveries = await deliveries_collection.find().sort("createdAt", -1).to_list(100)
        for delivery in deliveries:
            delivery["id"] = str(delivery["_id"])
        return [Delivery(**d) for d in deliveries]
    except Exception as e:
        logger.error(f"Error fetching deliveries: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/deliveries/available", response_model=List[Delivery])
async def get_available_deliveries():
    try:
        deliveries = await deliveries_collection.find({"status": "pending"}).sort("createdAt", -1).to_list(100)
        for delivery in deliveries:
            delivery["id"] = str(delivery["_id"])
        return [Delivery(**d) for d in deliveries]
    except Exception as e:
        logger.error(f"Error fetching available deliveries: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/deliveries/restaurant/{restaurant_id}", response_model=List[Delivery])
async def get_restaurant_deliveries(restaurant_id: str):
    try:
        deliveries = await deliveries_collection.find({"restaurantId": restaurant_id}).sort("createdAt", -1).to_list(100)
        for delivery in deliveries:
            delivery["id"] = str(delivery["_id"])
        return [Delivery(**d) for d in deliveries]
    except Exception as e:
        logger.error(f"Error fetching restaurant deliveries: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/deliveries/rider/{rider_id}", response_model=List[Delivery])
async def get_rider_deliveries(rider_id: str):
    try:
        deliveries = await deliveries_collection.find({
            "riderId": rider_id,
            "status": {"$in": ["accepted", "picked_up", "in_transit"]}
        }).sort("createdAt", -1).to_list(100)
        for delivery in deliveries:
            delivery["id"] = str(delivery["_id"])
        return [Delivery(**d) for d in deliveries]
    except Exception as e:
        logger.error(f"Error fetching rider deliveries: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/deliveries/{delivery_id}", response_model=Delivery)
async def get_delivery(delivery_id: str):
    try:
        delivery = await deliveries_collection.find_one({"deliveryId": delivery_id})
        if not delivery:
            raise HTTPException(status_code=404, detail="Delivery not found")
        delivery["id"] = str(delivery["_id"])
        return Delivery(**delivery)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching delivery: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.patch("/deliveries/{delivery_id}/accept")
async def accept_delivery(delivery_id: str, rider_id: str):
    try:
        # Get rider info
        rider = await riders_collection.find_one({"id": rider_id})
        if not rider:
            raise HTTPException(status_code=404, detail="Rider not found")
        
        # Update delivery
        tracking_event = {
            "status": "accepted",
            "time": datetime.utcnow(),
            "message": "Rider assegnato"
        }
        
        result = await deliveries_collection.update_one(
            {"deliveryId": delivery_id},
            {
                "$set": {
                    "status": "accepted",
                    "riderId": rider_id,
                    "riderName": rider["name"],
                    "riderAvatar": rider["avatar"],
                    "riderVehicle": rider["vehicle"],
                    "riderRating": rider["rating"],
                    "acceptedAt": datetime.utcnow(),
                    "estimatedDelivery": calculate_estimated_delivery()
                },
                "$push": {"tracking": tracking_event}
            }
        )
        
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Delivery not found")
        
        logger.info(f"Delivery {delivery_id} accepted by rider {rider_id}")
        return {"message": "Delivery accepted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error accepting delivery: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.patch("/deliveries/{delivery_id}/status")
async def update_delivery_status(delivery_id: str, update_data: DeliveryUpdate):
    try:
        status_messages = {
            "picked_up": "Ordine ritirato",
            "in_transit": "In consegna",
            "delivered": "Consegnato",
            "cancelled": "Annullato"
        }
        
        tracking_event = {
            "status": update_data.status,
            "time": datetime.utcnow(),
            "message": update_data.message or status_messages.get(update_data.status, "Stato aggiornato")
        }
        
        update_fields = {
            "status": update_data.status
        }
        
        if update_data.status == "picked_up":
            update_fields["pickupTime"] = datetime.utcnow()
        elif update_data.status == "delivered":
            update_fields["deliveredAt"] = datetime.utcnow()
        
        result = await deliveries_collection.update_one(
            {"deliveryId": delivery_id},
            {
                "$set": update_fields,
                "$push": {"tracking": tracking_event}
            }
        )
        
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Delivery not found")
        
        logger.info(f"Delivery {delivery_id} status updated to {update_data.status}")
        return {"message": "Status updated successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating delivery status: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# Chat Endpoints
@router.get("/chat/{delivery_id}", response_model=List[Message])
async def get_chat_messages(delivery_id: str):
    try:
        messages = await messages_collection.find({"deliveryId": delivery_id}).sort("timestamp", 1).to_list(1000)
        for message in messages:
            message["id"] = str(message["_id"])
        return [Message(**m) for m in messages]
    except Exception as e:
        logger.error(f"Error fetching chat messages: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/chat/{delivery_id}", response_model=Message)
async def send_message(delivery_id: str, message_data: MessageCreate):
    try:
        message_dict = message_data.dict()
        message_dict["deliveryId"] = delivery_id
        message_dict["timestamp"] = datetime.utcnow()
        message_dict["read"] = False
        
        result = await messages_collection.insert_one(message_dict)
        message_dict["id"] = str(result.inserted_id)
        
        logger.info(f"Message sent for delivery {delivery_id}")
        return Message(**message_dict)
    except Exception as e:
        logger.error(f"Error sending message: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# Riders Endpoints
@router.get("/riders", response_model=List[Rider])
async def get_riders():
    try:
        await init_sample_riders()
        riders = await riders_collection.find().to_list(100)
        return [Rider(**r) for r in riders]
    except Exception as e:
        logger.error(f"Error fetching riders: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/riders/{rider_id}", response_model=Rider)
async def get_rider(rider_id: str):
    try:
        rider = await riders_collection.find_one({"id": rider_id})
        if not rider:
            raise HTTPException(status_code=404, detail="Rider not found")
        return Rider(**rider)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching rider: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))