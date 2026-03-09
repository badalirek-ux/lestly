import os
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

load_dotenv()

MONGO_URL = os.getenv("MONGO_URL")

client = AsyncIOMotorClient(
    MONGO_URL,
    serverSelectionTimeoutMS=30000,
    connectTimeoutMS=30000,
    retryWrites=True,
    tls=True,
    tlsAllowInvalidCertificates=False,
)

db = client.lestly

deliveries_collection   = db.get_collection("deliveries")
messages_collection     = db.get_collection("messages")
riders_collection       = db.get_collection("riders")
restaurants_collection  = db.get_collection("restaurants")

print("✅ Connessione MongoDB avviata...")
