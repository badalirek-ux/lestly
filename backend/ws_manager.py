import json
from fastapi import WebSocket

class ConnectionManager:
    def __init__(self):
        self.rooms: dict[str, list[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, room_id: str):
        await websocket.accept()
        self.rooms.setdefault(room_id, []).append(websocket)

    def disconnect(self, websocket: WebSocket, room_id: str):
        room = self.rooms.get(room_id, [])
        if websocket in room:
            room.remove(websocket)

    async def broadcast(self, room_id: str, data: dict):
        for ws in list(self.rooms.get(room_id, [])):
            try:
                await ws.send_text(json.dumps(data))
            except Exception:
                pass

manager = ConnectionManager()
