import asyncio
import aiohttp
import json

async def test_websocket():
    url = 'wss://app-p2p.onrender.com/ws'
    print(f"Connecting to {url}...")
    try:
        async with aiohttp.ClientSession() as session:
            async with session.ws_connect(url) as ws:
                print("Connected!")
                await ws.send_json({'action': 'join', 'room': 'test-room'})
                async for msg in ws:
                    if msg.type == aiohttp.WSMsgType.TEXT:
                        data = json.loads(msg.data)
                        print(f"Received: {data}")
                        break
                    elif msg.type == aiohttp.WSMsgType.ERROR:
                        print('ws connection closed with exception %s',
                              ws.exception())
    except Exception as e:
        print(f"Connection failed: {e}")

if __name__ == '__main__':
    asyncio.run(test_websocket())
