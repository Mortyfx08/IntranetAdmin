import asyncio
import uuid
import logging
from typing import Dict
from fastapi import WebSocket, WebSocketDisconnect

logger = logging.getLogger(__name__)

_RDP_TOKENS: Dict[str, dict] = {}

GUACD_HOST = "127.0.0.1"
GUACD_PORT = 4822

def generate_rdp_token(ip: str, width: int = 1024, height: int = 768, username: str = "", password: str = "") -> str:
    token = str(uuid.uuid4())
    _RDP_TOKENS[token] = {
        "ip": ip,
        "width": width,
        "height": height,
        "username": username,
        "password": password
    }
    return token

class GuacdClient:
    def __init__(self, host: str, port: int):
        self.host = host
        self.port = port
        self.reader = None
        self.writer = None

    async def connect(self):
        self.reader, self.writer = await asyncio.open_connection(self.host, self.port)

    async def handshake(self, ip: str, width: int, height: int, username: str = "", password: str = ""):
        # 1. Send select
        select_cmd = self._encode(["select", "rdp"])
        self.writer.write(select_cmd.encode('utf-8'))
        await self.writer.drain()

        # 2. Receive args from guacd
        reply = await self._read_instruction()
        if not reply or reply[0] != "args":
            raise Exception("Invalid guacd handshake: expected args")

        # 3. Send connect with chosen args
        expected_args = reply[1:]
        connect_args = []
        for arg_name in expected_args:
            if arg_name == "hostname":
                connect_args.append(ip)
            elif arg_name == "port":
                connect_args.append("3389")
            elif arg_name == "width":
                connect_args.append(str(width))
            elif arg_name == "height":
                connect_args.append(str(height))
            elif arg_name == "security":
                connect_args.append("any")
            elif arg_name == "ignore-cert":
                connect_args.append("true")
            elif arg_name == "enable-wallpaper":
                connect_args.append("false")
            elif arg_name == "resize-method":
                connect_args.append("display-update")
            elif arg_name == "username" and username:
                connect_args.append(username)
            elif arg_name == "password" and password:
                connect_args.append(password)
            else:
                connect_args.append("")

                
        connect_cmd = self._encode(["connect"] + connect_args)
        self.writer.write(connect_cmd.encode('utf-8'))
        await self.writer.drain()

        # 4. Wait for ready
        reply = await self._read_instruction()
        if not reply or reply[0] != "ready":
            raise Exception(f"guacd not ready: {reply}")

    def _encode(self, parts: list) -> str:
        res = []
        for p in parts:
            p_str = str(p)
            res.append(f"{len(p_str)}.{p_str}")
        return ",".join(res) + ";"

    async def _read_instruction(self) -> list:
        parts = []
        while True:
            # read length
            len_str = ""
            while True:
                c = await self.reader.read(1)
                if not c:
                    return parts
                c_str = c.decode('utf-8')
                if c_str == '.':
                    break
                len_str += c_str
            
            if not len_str:
                break
                
            length = int(len_str)
            val = await self.reader.read(length)
            parts.append(val.decode('utf-8'))
            
            term = await self.reader.read(1)
            if term == b';':
                break
            elif term == b',':
                continue
        return parts

    async def pump_to_ws(self, websocket: WebSocket):
        try:
            while True:
                # Read chunks and pass raw Guacamole instructions to WebSocket
                data = await self.reader.read(4096)
                if not data:
                    break
                await websocket.send_text(data.decode('utf-8'))
        except asyncio.CancelledError:
            pass
        except Exception as e:
            logger.error(f"Error pumping to ws: {e}")

    async def pump_from_ws(self, websocket: WebSocket):
        try:
            while True:
                data = await websocket.receive_text()
                self.writer.write(data.encode('utf-8'))
                await self.writer.drain()
        except WebSocketDisconnect:
            pass
        except asyncio.CancelledError:
            pass
        except Exception as e:
            logger.error(f"Error pumping from ws: {e}")

async def handle_rdp_ws(websocket: WebSocket, token: str):
    await websocket.accept()
    
    session = _RDP_TOKENS.get(token)
    if not session:
        await websocket.close(code=1008, reason="Invalid token")
        return
        
    # Optional: Delete token so it's one-time use
    del _RDP_TOKENS[token]

    guacd = GuacdClient(GUACD_HOST, GUACD_PORT)
    try:
        await guacd.connect()
        await guacd.handshake(
            session["ip"],
            session.get("width", 1024),
            session.get("height", 768),
            session.get("username", ""),
            session.get("password", "")
        )
    except Exception as e:
        logger.error(f"Failed to connect to guacd: {e}")
        await websocket.close(code=1011, reason="Guacd connection failed")
        return

    # Start bi-directional pump
    to_ws = asyncio.create_task(guacd.pump_to_ws(websocket))
    from_ws = asyncio.create_task(guacd.pump_from_ws(websocket))

    done, pending = await asyncio.wait(
        [to_ws, from_ws],
        return_when=asyncio.FIRST_COMPLETED
    )

    for task in pending:
        task.cancel()
        
    guacd.writer.close()
    await guacd.writer.wait_closed()
