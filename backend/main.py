from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from routes import router as api_routes
from ws_manager import manager
import logging
import json

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("main")

app = FastAPI(title="Lestly API", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Middleware manuale CORS — gestisce OPTIONS preflight
@app.middleware("http")
async def cors_middleware(request: Request, call_next):
    if request.method == "OPTIONS":
        return JSONResponse(
            content={},
            headers={
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
                "Access-Control-Allow-Headers": "*",
            }
        )
    response = await call_next(request)
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, PATCH, DELETE, OPTIONS"
    response.headers["Access-Control-Allow-Headers"] = "*"
    return response

app.include_router(api_routes, prefix="/api")




@app.websocket("/ws/chat")
async def websocket_chat(websocket: WebSocket, room: str = "global"):
    """
    WebSocket per chat in tempo reale.
    Connettiti con: ws://localhost:8000/ws/chat?room=<deliveryId>
    """
    await manager.connect(websocket, room)
    try:
        while True:
            raw = await websocket.receive_text()
            data = json.loads(raw)
            # Broadcast a tutti nella stessa room
            await manager.broadcast(room, {"event": "chat:message", **data})
    except WebSocketDisconnect:
        manager.disconnect(websocket, room)
        logger.info(f"WS disconnected from room '{room}'")


@app.websocket("/ws/deliveries")
async def websocket_deliveries(websocket: WebSocket):
    """
    WebSocket per aggiornamenti consegne in tempo reale.
    Tutti i client nella room 'deliveries' ricevono gli eventi.
    """
    await manager.connect(websocket, "deliveries")
    try:
        while True:
            raw = await websocket.receive_text()
            data = json.loads(raw)
            await manager.broadcast("deliveries", data)
    except WebSocketDisconnect:
        manager.disconnect(websocket, "deliveries")


@app.get("/")
async def root():
    return {"message": "RiderExpress API v2.0 is running 🛵"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
