import logging
import os
import uuid
import json
import asyncio
import argparse
import ssl
from aiohttp import web
import aiohttp_cors

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("P2P-Server")

# Store active rooms and peers
# Structure: { room_id: { peer_id: websocket } }
rooms = {}

async def index(request):
    return web.FileResponse('./dist/index.html')

# ... (rest of the file)



async def get_config(request):
    """
    Returns ICE server configuration.
    In a production environment, you might want to fetch ephemeral TURN credentials here.
    """
    return web.json_response({
        'iceServers': [
            {'urls': 'stun:stun.l.google.com:19302'},
            {'urls': 'stun:stun1.l.google.com:19302'},
            {'urls': 'stun:stun2.l.google.com:19302'},
        ]
    })

async def websocket_handler(request):
    ws = web.WebSocketResponse(heartbeat=30.0)
    # Allow all origins for native apps
    if request.headers.get('Origin') != 'null':
         pass # Handled by CORS setup, but WS upgrade might need explicit check if strict
    
    await ws.prepare(request)

    peer_id = str(uuid.uuid4())
    current_room = None
    
    logger.info(f"New connection established. Peer ID: {peer_id}")

    try:
        async for msg in ws:
            if msg.type == web.WSMsgType.TEXT:
                try:
                    data = json.loads(msg.data)
                    action = data.get('action')

                    if action == 'join':
                        room_id = data.get('room')
                        if not room_id:
                            room_id = str(uuid.uuid4())[:8]
                        
                        current_room = room_id
                        if current_room not in rooms:
                            rooms[current_room] = {}
                        
                        rooms[current_room][peer_id] = ws
                        
                        logger.info(f"Peer {peer_id} joined room {current_room}")

                        # Notify the peer of their ID and the room they joined
                        await ws.send_json({
                            'type': 'joined',
                            'peer_id': peer_id,
                            'room_id': current_room,
                            'peers': [p for p in rooms[current_room] if p != peer_id]
                        })
                        
                        # Notify other peers in the room
                        for pid, socket in rooms[current_room].items():
                            if pid != peer_id:
                                await socket.send_json({
                                    'type': 'peer-joined',
                                    'peer_id': peer_id
                                })

                    elif action == 'signal':
                        target_peer = data.get('target')
                        payload = data.get('payload')
                        
                        if current_room and target_peer in rooms.get(current_room, {}):
                            target_ws = rooms[current_room][target_peer]
                            await target_ws.send_json({
                                'type': 'signal',
                                'sender': peer_id,
                                'payload': payload
                            })
                            logger.debug(f"Signal relayed from {peer_id} to {target_peer}")
                        else:
                            logger.warning(f"Signal failed: Target {target_peer} not found in room {current_room}")

                except json.JSONDecodeError:
                    logger.error("Failed to decode JSON message")
                except Exception as e:
                    logger.error(f"Error processing message: {e}")

            elif msg.type == web.WSMsgType.ERROR:
                logger.error(f'WebSocket connection closed with exception {ws.exception()}')

    finally:
        if current_room and current_room in rooms:
            if peer_id in rooms[current_room]:
                del rooms[current_room][peer_id]
                logger.info(f"Peer {peer_id} left room {current_room}")
                
                # Notify others that peer left
                for pid, socket in rooms[current_room].items():
                    try:
                        await socket.send_json({
                            'type': 'peer-left',
                            'peer_id': peer_id
                        })
                    except Exception as e:
                        logger.error(f"Failed to notify peer {pid}: {e}")
                
                # Clean up empty rooms
                if not rooms[current_room]:
                    del rooms[current_room]
                    logger.info(f"Room {current_room} deleted (empty)")
        
        logger.info(f"Peer {peer_id} disconnected")

    return ws

app = web.Application()

# Configure CORS
cors = aiohttp_cors.setup(app, defaults={
    "*": aiohttp_cors.ResourceOptions(
        allow_credentials=True,
        expose_headers="*",
        allow_headers="*",
    )
})

# Add routes
app.router.add_get('/', index)
# API Routes (Need CORS)
cors.add(app.router.add_get('/config', get_config))
cors.add(app.router.add_get('/ws', websocket_handler))

# Serve static files from root (must be last to avoid shadowing API)
app.router.add_static('/', './dist')

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description="P2P File Transfer Server")
    parser.add_argument('--cert', help="Path to SSL certificate file (PEM)")
    parser.add_argument('--key', help="Path to SSL key file (PEM)")
    parser.add_argument('--port', type=int, default=8080, help="Port to run the server on")
    args = parser.parse_args()

    # Priority: Env Var > Args > Default
    port = int(os.environ.get("PORT", args.port))

    ssl_context = None
    if args.cert and args.key:
        if os.path.exists(args.cert) and os.path.exists(args.key):
            ssl_context = ssl.create_default_context(ssl.Purpose.CLIENT_AUTH)
            ssl_context.load_cert_chain(args.cert, args.key)
            logger.info(f"Starting server with HTTPS on port {port}")
        else:
            logger.error("Certificate or Key file not found. Starting in HTTP mode.")
    else:
        logger.info(f"Starting server on port {port}")

    web.run_app(app, port=port, ssl_context=ssl_context)
