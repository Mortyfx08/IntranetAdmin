from fastapi import FastAPI, Depends, HTTPException, Header, BackgroundTasks, Request, WebSocket, WebSocketDisconnect
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session
from sqlalchemy import select, update, delete
from typing import List, Dict, Any, Optional
from concurrent.futures import ProcessPoolExecutor as _PPE
import asyncio
import socket
import logging
from datetime import datetime, timedelta

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend import models, schemas, scanner
from backend.database import async_session, engine
from pydantic import BaseModel

# Persistent scan worker pool (pre-warmed at startup)
_SCAN_POOL: Optional[_PPE] = None

# Configure logging
logging.basicConfig(level=logging.INFO)
logging.getLogger("scapy.runtime").setLevel(logging.ERROR)
logger = logging.getLogger(__name__)

# WebSocket Connection Manager
class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)

    async def broadcast(self, message: dict):
        import json as _json

        def _default(obj):
            if isinstance(obj, datetime):
                return obj.isoformat()
            raise TypeError(f"Object of type {type(obj)} is not JSON serializable")

        payload = _json.dumps(message, default=_default)
        for connection in self.active_connections:
            try:
                await connection.send_text(payload)
            except Exception as e:
                logger.error(f"Error broadcasting to WS: {e}")


manager = ConnectionManager()

app = FastAPI(title="NetSentry Orchestrator")

# --- Localization Middleware ---
@app.middleware("http")
async def add_localization(request: Request, call_next):
    # Detect language from Accept-Language header
    accept_lang = request.headers.get("accept-language", "en")
    # Simple parser: take the first part of the first language
    primary_lang = accept_lang.split(",")[0].split("-")[0].lower()
    request.state.lang = primary_lang
    response = await call_next(request)
    return response

# Mount static files
import os
STATIC_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "static")
if not os.path.exists(STATIC_DIR):
    os.makedirs(STATIC_DIR, exist_ok=True)
app.mount("/download", StaticFiles(directory=STATIC_DIR), name="static")

# Dependency
async def get_db():
    async with async_session() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()

# Constants
SHARED_SECRET = "netsentry-secret"


def get_ethernet_ip() -> tuple:
    """
    Returns (ip, subnet_cidr) for the physical wired Ethernet adapter.
    Priority:
      1. Wired adapter: description contains 'ethernet' but NOT '802.11'/'wireless'/'wi-fi'
      2. Any non-virtual, non-wireless adapter
      3. Socket fallback
    """
    try:
        from scapy.all import conf, get_if_addr

        candidates = []
        for iface_name, iface_obj in conf.ifaces.items():
            desc = (getattr(iface_obj, 'description', '') or '').strip()
            desc_l = desc.lower()

            # Get IP
            ip = ''
            try:
                ip = get_if_addr(iface_obj.pcap_name if hasattr(iface_obj, 'pcap_name') else iface_name)
            except Exception:
                pass
            if not ip or ip == '0.0.0.0' or ip.startswith('127.'):
                continue

            # Always skip virtual, wireless, and loopback
            SKIP = ('virtual', 'vmware', 'vbox', 'hyper-v', 'loopback', 'tunnel',
                    'wi-fi', 'wireless', 'wlan', '802.11', 'bluetooth', 'miniport')
            if any(k in desc_l for k in SKIP):
                continue

            # Score wired Ethernet highest
            if 'ethernet' in desc_l and '802.11' not in desc_l:
                score = 3
            elif any(k in desc_l for k in ('gigabit', 'realtek', 'intel', 'broadcom')):
                score = 2
            else:
                score = 1

            candidates.append((score, ip, desc))
            logger.debug(f"  Interface candidate: [{score}] {desc} -> {ip}")

        if candidates:
            candidates.sort(reverse=True)
            best_ip = candidates[0][1]
            octets = best_ip.split('.')
            subnet = f"{octets[0]}.{octets[1]}.{octets[2]}.0/24"
            logger.info(f"Ethernet adapter selected: {candidates[0][2]} → {best_ip} / {subnet}")
            return best_ip, subnet

    except Exception as e:
        logger.warning(f"get_ethernet_ip failed: {e}")

def _get_ip_fast() -> tuple:
    """Detection logic using psutil to prioritize Ethernet over Wi-Fi/Virtual."""
    try:
        import psutil
        addrs = psutil.net_if_addrs()
        candidates = []
        for iface_name, iface_addrs in addrs.items():
            for addr in iface_addrs:
                if addr.family == 2:  # AF_INET
                    ip = addr.address
                    if ip.startswith('127.') or ip.startswith('169.254'):
                        continue
                    
                    name_l = iface_name.lower()
                    # Priority: 1. Real Ethernet (not virtual), 2. Local Area Connection, 3. Virtual/Wi-Fi
                    SKIP = ('virtual', 'switch', 'vbox', 'vmware', 'hyper-v', 'wlan', 'wi-fi')
                    is_virtual = any(k in name_l for k in SKIP)
                    
                    if ('ethernet' in name_l or 'réseau local' in name_l) and not is_virtual:
                        score = 4
                    elif is_virtual:
                        score = 1
                    else:
                        score = 2
                    
                    candidates.append((score, ip))
        
        if candidates:
            candidates.sort(reverse=True)
            best_ip = candidates[0][1]
            octets = best_ip.split('.')
            return best_ip, f"{octets[0]}.{octets[1]}.{octets[2]}.0/24"
    except Exception:
        pass

    # Socket fallback (standard default route)
    try:
        import socket as _s
        sock = _s.socket(_s.AF_INET, _s.SOCK_DGRAM)
        sock.connect(("8.8.8.8", 80))
        ip = sock.getsockname()[0]
        sock.close()
        octets = ip.split('.')
        return ip, f"{octets[0]}.{octets[1]}.{octets[2]}.0/24"
    except Exception:
        return "127.0.0.1", "127.0.0.1/32"

_SERVER_IP, SUBNET_TO_SCAN = _get_ip_fast()

logger.info(f"Server IP (fast): {_SERVER_IP}  Subnet: {SUBNET_TO_SCAN}")

@app.get("/")
async def read_root():
    return {"status": "NetSentry Orchestrator Running"}

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)

# --- Devisions ---
@app.post("/api/devisions", response_model=schemas.Devision)
async def create_devision(devision: schemas.DevisionCreate, db: Session = Depends(get_db)):
    try:
        db_dev = models.Devision(**devision.dict())
        db.add(db_dev)
        await db.commit()
        await db.refresh(db_dev)
        return db_dev
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=400, detail="A devision with this name already exists")

@app.get("/api/devisions", response_model=List[schemas.Devision])
async def get_devisions(request: Request, db: Session = Depends(get_db)):
    lang = getattr(request.state, "lang", "en")
    result = await db.execute(select(models.Devision))
    items = result.scalars().all()
    
    # Localize names on the fly
    for item in items:
        if item.translations and lang in item.translations:
            item.name = item.translations[lang]
            
    await db.commit()
    return items

@app.put("/api/devisions/{dev_id}", response_model=schemas.Devision)
async def update_devision(dev_id: int, devision: schemas.DevisionCreate, db: Session = Depends(get_db)):
    result = await db.execute(select(models.Devision).filter(models.Devision.id == dev_id))
    db_dev = result.scalar_one_or_none()
    if not db_dev:
        raise HTTPException(status_code=404, detail="Devision not found")
    db_dev.name = devision.name
    db_dev.color = devision.color
    db_dev.info = devision.info
    await db.commit()
    await db.refresh(db_dev)
    return db_dev

@app.delete("/api/devisions/{dev_id}")
async def delete_devision(dev_id: int, db: Session = Depends(get_db)):
    await db.execute(delete(models.Devision).filter(models.Devision.id == dev_id))
    await db.commit()
    await manager.broadcast({"type": "topology_refresh"})
    return {"status": "ok"}

# --- Services ---
@app.post("/api/services", response_model=schemas.Service)
async def create_service(service: schemas.ServiceCreate, db: Session = Depends(get_db)):
    db_service = models.Service(**service.dict())
    db.add(db_service)
    await db.commit()
    await db.refresh(db_service)
    return db_service

@app.get("/api/services", response_model=List[schemas.Service])
async def get_services(request: Request, db: Session = Depends(get_db)):
    lang = getattr(request.state, "lang", "en")
    result = await db.execute(select(models.Service))
    items = result.scalars().all()
    
    # Localize names on the fly
    for item in items:
        if item.translations and lang in item.translations:
            item.name = item.translations[lang]
            
    await db.commit()
    return items

@app.put("/api/services/{service_id}", response_model=schemas.Service)
async def update_service(service_id: int, service: schemas.ServiceCreate, db: Session = Depends(get_db)):
    result = await db.execute(select(models.Service).filter(models.Service.id == service_id))
    db_service = result.scalar_one_or_none()
    if not db_service:
        raise HTTPException(status_code=404, detail="Service not found")
    
    for key, value in service.dict().items():
        setattr(db_service, key, value)
    
    await db.commit()
    await db.refresh(db_service)
    return db_service

@app.delete("/api/services/{service_id}")
async def delete_service(service_id: int, db: Session = Depends(get_db)):
    # Nullify service_id on devices before deleting the service
    await db.execute(
        update(models.Device)
        .filter(models.Device.service_id == service_id)
        .values(service_id=None)
    )
    await db.execute(delete(models.Service).filter(models.Service.id == service_id))
    await db.commit()
    await manager.broadcast({"type": "topology_refresh"})
    return {"status": "ok"}

@app.delete("/api/devices/by-id/{device_id}")
async def delete_device_by_id(device_id: int, db: Session = Depends(get_db)):
    """Delete device by integer database ID — reliable, avoids MAC URL issues"""
    result = await db.execute(select(models.Device).filter(models.Device.id == device_id))
    dev = result.scalar_one_or_none()
    if not dev:
        raise HTTPException(status_code=404, detail="Device not found")
    await db.execute(delete(models.Device).filter(models.Device.id == device_id))
    await db.commit()
    await manager.broadcast({"type": "topology_refresh"})
    return {"status": "ok", "deleted": dev.hostname or dev.ip_address}

@app.delete("/api/devices/{mac}")
async def delete_device(mac: str, db: Session = Depends(get_db)):
    """Delete device by MAC address (URL-encoded colons: 30%3A24%3Aa9%3A7d%3Acb%3Ab5)"""
    from urllib.parse import unquote
    decoded_mac = await _resolve_target_mac(unquote(mac), db)
    result = await db.execute(select(models.Device).filter(models.Device.mac_address == decoded_mac))
    dev = result.scalar_one_or_none()
    if not dev:
        raise HTTPException(status_code=404, detail=f"Device not found: {decoded_mac}")
    await db.execute(delete(models.Device).filter(models.Device.mac_address == decoded_mac))
    await db.commit()
    await manager.broadcast({"type": "topology_refresh"})
    return {"status": "ok", "deleted": dev.hostname or dev.ip_address}

@app.patch("/api/devices/{mac}/assign")
async def assign_device_to_service(mac: str, payload: dict, db: Session = Depends(get_db)):
    """Assign (or unassign) a device to a service by integer service_id.
    Body: {"service_id": 3}  or {"service_id": null} to unassign.
    """
    from urllib.parse import unquote
    decoded_mac = await _resolve_target_mac(unquote(mac), db)
    result = await db.execute(select(models.Device).filter(models.Device.mac_address == decoded_mac))
    dev = result.scalar_one_or_none()
    if not dev:
        raise HTTPException(status_code=404, detail=f"Device not found: {decoded_mac}")

    service_id = payload.get("service_id")

    if service_id is not None:
        # Validate service exists
        svc_result = await db.execute(select(models.Service).filter(models.Service.id == service_id))
        svc = svc_result.scalar_one_or_none()
        if not svc:
            raise HTTPException(status_code=404, detail=f"Service not found: {service_id}")

    dev.service_id = service_id
    await db.commit()
    return {"status": "ok", "mac": decoded_mac, "service_id": service_id}

@app.get("/api/devices")
async def get_all_devices(db: Session = Depends(get_db)):
    """Return all registered devices as a flat list."""
    result = await db.execute(select(models.Device))
    devices = result.scalars().all()
    return [schemas.DeviceSchema.from_orm(d).dict() for d in devices]

def _normalize_mac(mac: str) -> str:
    """Consistently lower-case MAC addresses to avoid SQLite case-sensitivity issues."""
    return (mac or "").strip().lower()

async def _resolve_target_mac(mac: str, db: Session) -> str:
    """Normalize MAC and resolve 'server' alias to real MAC."""
    n_mac = _normalize_mac(mac)
    if n_mac == "server":
        local_hostname = socket.gethostname()
        logger.info(f"Resolving 'server' alias using hostname: {local_hostname}")
        # Find the actual server device record
        srv_result = await db.execute(
            select(models.Device).filter(
                (models.Device.hostname.ilike(local_hostname)) | 
                (models.Device.hostname.ilike("IntranetAdmin"))
            )
        )
        server_dev = srv_result.scalar_one_or_none()
        if server_dev:
            return server_dev.mac_address
        else:
            raise HTTPException(status_code=404, detail="Server agent not yet registered. Please start the agent on the server first.")
    return n_mac

# --- Control & Reporting ---
@app.post("/api/control/{mac}")
async def queue_command(mac: str, cmd: schemas.CommandCreate, db: Session = Depends(get_db)):
    # Resolve target MAC (handles normalization and 'server' alias)
    target_mac = await _resolve_target_mac(cmd.target_mac or mac, db)

    db_cmd = models.CommandQueue(
        target_mac=target_mac,
        command=cmd.command,
        params=cmd.params,
        status="pending"
    )
    db.add(db_cmd)
    
    # Backend Logging Enhancements
    result = await db.execute(select(models.Device).filter(models.Device.mac_address == target_mac))
    target_device = result.scalar_one_or_none()
    
    ip_addr = "Unknown IP"
    hostname = "Unknown Host"
    
    if target_device:
        ip_addr = target_device.ip_address or "Unknown IP"
        hostname = target_device.hostname or "Unknown Host"
        
        # Track RDP Sessions if the command is ENABLE_RDP
        if cmd.command == "ENABLE_RDP":
            rdp_session = models.RDPSession(
                target_pc_id=target_device.id,
                # In a real app we'd get the admin_id from the token, for now it's null
            )
            db.add(rdp_session)

        # NEW: Automatic Password Sync for RDP
        if cmd.command == "CHANGE_PASSWORD":
            new_user = cmd.params.get("user")
            new_pass = cmd.params.get("pass")
            if new_user and new_pass:
                target_device.user_name = new_user
                target_device.saved_password = new_pass
                logger.info(f"Automatically synced RDP credentials for {hostname} to user '{new_user}'")
            
    logger.info(f"Command [{cmd.command}] queued for Device: {hostname} ({ip_addr}) [MAC: {target_mac}]")
    
    await db.commit()
    
    # Broadcast command queued event
    await manager.broadcast({
        "type": "command_queued",
        "mac": target_mac,
        "command": cmd.command,
        "status": "pending"
    })
    
    return {"status": "queued", "command_id": db_cmd.id}

@app.delete("/api/v2/rdp/last-action/by-mac/{mac}")
async def delete_last_rdp_by_mac(mac: str, db: Session = Depends(get_db)):
    """Revoke last RDP action by device MAC (for topology/drawer when only MAC is available)."""
    from urllib.parse import unquote
    decoded_mac = _normalize_mac(unquote(mac))
    result = await db.execute(select(models.Device).filter(models.Device.mac_address == decoded_mac))
    device = result.scalar_one_or_none()
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")
    return await _do_delete_last_rdp(device, db)


async def _do_delete_last_rdp(device, db):
    """Shared logic: revoke last RDP session for device and queue DISABLE_RDP."""
    rdp_result = await db.execute(
        select(models.RDPSession)
        .filter(models.RDPSession.target_pc_id == device.id)
        .order_by(models.RDPSession.start_time.desc())
    )
    last_session = rdp_result.scalars().first()
    if last_session:
        await db.execute(delete(models.RDPSession).filter(models.RDPSession.id == last_session.id))
    revoke_cmd = models.CommandQueue(
        target_mac=device.mac_address,
        command="DISABLE_RDP",
        params={},
        status="pending"
    )
    db.add(revoke_cmd)
    await db.commit()
    logger.info(f"RDP Action Revoked for Device: {device.hostname} ({device.ip_address}). Agent commanded to LOCK RDP.")
    return {"status": "Action Revoked & PC Locked"}


@app.delete("/api/v2/rdp/last-action/{pc_id}")
async def delete_last_rdp(pc_id: int, db: Session = Depends(get_db)):
    """Revoke last RDP action by device DB id."""
    result = await db.execute(select(models.Device).filter(models.Device.id == pc_id))
    device = result.scalar_one_or_none()
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")
    return await _do_delete_last_rdp(device, db)

@app.post("/api/report")
async def report_agent(
    report: schemas.AgentReport, 
    x_shared_secret: str = Header(None),
    db: Session = Depends(get_db)
):
    if x_shared_secret != SHARED_SECRET:
        raise HTTPException(status_code=403, detail="Invalid Shared Secret")

    # Allowed to register server itself — it dynamically augments the root node
    report.mac_address = _normalize_mac(report.mac_address)

    # Skip invalid or unresolved IP/MAC combinations (ghost reports)
    if report.ip_address == "0.0.0.0" or report.mac_address == "00:00:00:00:00:00":
        return {"status": "ignored", "reason": "invalid IP or MAC"}

    result = await db.execute(select(models.Device).filter(models.Device.mac_address == report.mac_address))
    device = result.scalar_one_or_none()
    
    update_data = report.dict(exclude={"mac_address"})
    update_data["last_seen"] = datetime.utcnow()
    update_data["status"] = "online"
    update_data["agent_status"] = "online" # SOURCE OF TRUTH for agent process
    update_data["has_agent"] = True  # mark as agent-managed device
    
    msg = f"[!!! HEARTBEAT !!!] {datetime.now().strftime('%H:%M:%S')} - Host: {report.hostname} | IP: {report.ip_address}"
    print(msg)
    logger.info(msg)

    if report.ip_address == _SERVER_IP:
        update_data["hostname"] = "IntranetAdmin"
        logger.info(f"Force hostname 'IntranetAdmin' for server IP: {report.ip_address}")

    if device:
        for key, value in update_data.items():
            setattr(device, key, value)
    else:
        device = models.Device(mac_address=report.mac_address, **update_data)
        db.add(device)
    
    try:
        # We rely on get_db dependency to commit the final state.
        # This reduces redundant write locks on the DB for high reporting frequency.
        pass 
    except Exception as e:
        if "locked" in str(e).lower():
            logger.debug(f"DB locked during agent {report.hostname} check-in. Agent will retry.")
            await db.rollback()
            raise HTTPException(status_code=503, detail="Database locked")
        raise
    
    
    # Fetch pending commands
    cmd_result = await db.execute(
        select(models.CommandQueue).filter(
            models.CommandQueue.target_mac == report.mac_address,
            models.CommandQueue.status == "pending"
        )
    )
    commands = cmd_result.scalars().all()
    
    pending_cmds = []
    for cmd in commands:
        pending_cmds.append({"id": cmd.id, "command": cmd.command, "params": cmd.params})
        cmd.status = "sent"
    
    # Command status changes will also be committed by the dependency
    pass
    
    # Broadcast update to UI
    await manager.broadcast({
        "type": "device_update",
        "device": schemas.DeviceSchema.from_orm(device).dict()
    })
    
    return {"status": "ok", "commands": pending_cmds}

@app.post("/api/command/result")
async def report_command_result(
    result: schemas.CommandResult,
    x_shared_secret: str = Header(None),
    db: Session = Depends(get_db)
):
    if x_shared_secret != SHARED_SECRET:
        raise HTTPException(status_code=403, detail="Invalid Shared Secret")

    # Update command status
    cmd_result = await db.execute(select(models.CommandQueue).filter(models.CommandQueue.id == result.command_id))
    db_cmd = cmd_result.scalar_one_or_none()
    
    if not db_cmd:
        raise HTTPException(status_code=404, detail="Command not found")

    db_cmd.status = result.status
    await db.commit()

    logger.info(f"Command {result.command_id} [{db_cmd.command}] reported as {result.status}. Output: {result.output}")

    # Broadcast to UI
    await manager.broadcast({
        "type": "command_result",
        "command_id": result.command_id,
        "status": result.status,
        "mac": db_cmd.target_mac,
        "output": result.output
    })

    return {"status": "ok"}

def _normalize_inventory_item(item: dict) -> dict:
    """Accept agent payload (DisplayName/DisplayVersion) or API (display_name/display_version)."""
    return {
        "display_name": item.get("display_name") or item.get("DisplayName") or "",
        "display_version": item.get("display_version") or item.get("DisplayVersion"),
        "install_date": item.get("install_date") or item.get("InstallDate"),
    }


@app.post("/api/inventory")
async def report_inventory(data: dict, db: Session = Depends(get_db)):
    """Accept inventory from agent (PascalCase keys) or API (snake_case)."""
    mac = _normalize_mac(data.get("mac_address", ""))
    inventory_raw = data.get("inventory", [])
    result = await db.execute(select(models.Device).filter(models.Device.mac_address == mac))
    device = result.scalar_one_or_none()
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")
    
    # Clear old inventory
    await db.execute(delete(models.Inventory).filter(models.Inventory.device_id == device.id))
    
    # Add new inventory (normalize keys from agent or API)
    for item in inventory_raw:
        norm = _normalize_inventory_item(item if isinstance(item, dict) else {})
        if norm["display_name"]:
            db_item = models.Inventory(device_id=device.id, **norm)
            db.add(db_item)
    
    await db.commit()
    
    await manager.broadcast({
        "type": "inventory_updated",
        "mac": mac
    })
    return {"status": "ok"}

@app.get("/api/devices/{mac}/inventory", response_model=List[schemas.Inventory])
async def get_device_inventory(mac: str, db: Session = Depends(get_db)):
    from urllib.parse import unquote
    decoded_mac = _normalize_mac(unquote(mac))
    result = await db.execute(select(models.Device).filter(models.Device.mac_address == decoded_mac))
    device = result.scalar_one_or_none()
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")
    
    inv_result = await db.execute(select(models.Inventory).filter(models.Inventory.device_id == device.id))
    return inv_result.scalars().all()

@app.post("/api/login")
async def login(user: schemas.UserLogin, db: Session = Depends(get_db)):
    import bcrypt as _bcrypt

    result = await db.execute(select(models.User).filter(models.User.username == user.username))
    db_user = result.scalar_one_or_none()
    if not db_user:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    try:
        pw_bytes = user.password.encode("utf-8")
        hash_bytes = db_user.hashed_password.encode("utf-8")
        password_ok = await asyncio.to_thread(_bcrypt.checkpw, pw_bytes, hash_bytes)
    except Exception:
        password_ok = False
    
    if not password_ok:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    return {"status": "ok", "username": db_user.username}


# ─── Scanner Endpoints ────────────────────────────────────────────────────────

class ScanRequest(BaseModel):
    subnet: str  # accepts: CIDR, single IP, or range like 192.168.1.1-50





def _arp_scan_sync(targets: list) -> list:
    """Synchronous ARP scan — runs in isolated subprocess."""
    try:
        from scapy.all import arping, conf, get_if_addr, get_if_hwaddr
        conf.verb = 0
        from backend.scanner import get_best_interface

        # Use first target to pick interface
        iface = get_best_interface(targets[0] if targets else "192.168.1.0/24")
        # Join list into Scapy-compatible string (handles CIDR, space-sep IPs)
        target_str = ' '.join(targets) if len(targets) <= 256 else targets[0]

        answered, _ = arping(target_str, iface=iface, verbose=0, timeout=3)

        results = []
        # Only add self_ip if it's actually in the targets we're scanning
        try:
            self_ip  = get_if_addr(iface)
            self_mac = get_if_hwaddr(iface)
            if self_ip and self_ip != "0.0.0.0":
                import ipaddress
                is_targeted = False
                for t in targets:
                    try:
                        if '/' in t: # CIDR
                            if ipaddress.IPv4Address(self_ip) in ipaddress.IPv4Network(t):
                                is_targeted = True
                                break
                        elif self_ip == t:
                            is_targeted = True
                            break
                        elif '-' in t: # Range
                            if self_ip in scanner.expand_target(t):
                                is_targeted = True
                                break
                    except Exception:
                        continue
                
                if is_targeted:
                    results.append({"ip": self_ip, "mac": self_mac, "status": "online"})
        except Exception:
            pass

        for _, rcv in answered:
            if rcv.psrc != self_ip:
                results.append({"ip": rcv.psrc, "mac": rcv.hwsrc, "status": "online"})
        return results
    except Exception as e:
        return []


# ─── Shared: Persist ARP results into the devices table ──────────────────────
async def upsert_scanned_devices(discovered: list, db: Session) -> list:
    """
    Upsert ARP-discovered hosts into the `devices` table.
    Uses MAC address as the unique key. If no MAC, uses IP.
    Returns the list of saved device dicts for the API response.
    """
    import socket as _socket
    saved = []
    for item in discovered:
        ip  = item.get("ip", "")
        mac = _normalize_mac(item.get("mac", ip))   # fall back to IP if no MAC
        if not ip:
            continue

        # Try reverse DNS (best-effort)
        hostname = ip
        if ip == _SERVER_IP:
            hostname = "IntranetAdmin"
        else:
            try:
                hostname = _socket.gethostbyaddr(ip)[0]
            except Exception:
                pass

        result = await db.execute(
            select(models.Device).filter(models.Device.mac_address == mac)
        )
        device = result.scalar_one_or_none()

        if device:
            # Update IP & last_seen; keep service_id/status from agent if set
            device.ip_address = ip
            device.last_seen  = datetime.utcnow()
            if device.status != "online":   # don't downgrade agent-reported status
                device.status = "online"
            if hostname != ip:
                device.hostname = hostname
        else:
            device = models.Device(
                mac_address = mac,
                ip_address  = ip,
                hostname    = hostname,
                status      = "online",
                last_seen   = datetime.utcnow(),
            )
            db.add(device)

        await db.flush()   # get the ID without full commit yet
        saved.append({
            "ip":     ip,
            "mac":    mac,
            "status": "online",
            "hostname": hostname if hostname != ip else None,
        })

    await db.commit()
    return saved


class PrepareRdpRequest(BaseModel):
    ip: str
    username: str
    password: str

@app.post("/api/rdp/prepare-credentials")
async def prepare_rdp_credentials(req: PrepareRdpRequest):
    """
    Injects RDP credentials directly into the Admin PC's Windows Credential Manager
    so that Native mstsc.exe can AutoLogon without prompting for a password.
    """
    import subprocess
    target = f"TERMSRV/{req.ip}"
    try:
        cmd = ["cmdkey", f"/generic:{target}", f"/user:{req.username}", f"/pass:{req.password}"]
        # subprocess.run blocks briefly to execute cmdkey natively on Windows
        proc = subprocess.run(cmd, capture_output=True, text=True, check=True)
        logger.info(f"RDP Credentials saved for {req.ip} via cmdkey.")
        return {"status": "ok", "message": "Credentials injected"}
    except subprocess.CalledProcessError as e:
        logger.error(f"Failed to inject RDP credentials: {e.stderr}")
        raise HTTPException(status_code=500, detail="Failed to save RDP credentials locally")


class SaveRdpPasswordRequest(BaseModel):
    password: str

@app.post("/api/devices/{mac}/rdp-password")
async def save_rdp_password(mac: str, req: SaveRdpPasswordRequest, db: Session = Depends(get_db)):
    """Save the RDP password for a specific device."""
    from urllib.parse import unquote
    decoded_mac = await _resolve_target_mac(unquote(mac), db)
    result = await db.execute(select(models.Device).filter(models.Device.mac_address == decoded_mac))
    device = result.scalar_one_or_none()
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")
    
    device.saved_password = req.password
    await db.commit()
    return {"status": "ok"}

@app.post("/api/devices/{mac}/prepare-rdp")
async def prepare_rdp_from_db(mac: str, db: Session = Depends(get_db)):
    """Inject saved RDP credentials directly from DB into Windows Credential Manager."""
    from urllib.parse import unquote
    decoded_mac = await _resolve_target_mac(unquote(mac), db)
    result = await db.execute(select(models.Device).filter(models.Device.mac_address == decoded_mac))
    device = result.scalar_one_or_none()
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")
    
    if not device.saved_password:
        raise HTTPException(status_code=400, detail="No password saved for this device")
        
    import subprocess
    target = f"TERMSRV/{device.ip_address}"
    username = device.user_name or "Administrator"
    try:
        cmd = ["cmdkey", f"/generic:{target}", f"/user:{username}", f"/pass:{device.saved_password}"]
        proc = subprocess.run(cmd, capture_output=True, text=True, check=True)
        logger.info(f"RDP Credentials retrieved from DB and saved for {device.ip_address} via cmdkey.")
        return {"status": "ok", "username": username}
    except subprocess.CalledProcessError as e:
        logger.error(f"Failed to inject RDP credentials: {e.stderr}")
        raise HTTPException(status_code=500, detail="Failed to inject RDP credentials locally")


@app.post("/api/scan/custom")
async def scan_custom(req: ScanRequest):
    """Manual ARP network scan — returns ephemeral results only, does NOT touch the devices DB."""
    if not req.subnet:
        raise HTTPException(status_code=400, detail="subnet is required")

    targets = scanner.expand_target(req.subnet)
    if not targets:
        raise HTTPException(status_code=400, detail="Invalid target format")

    import socket as _socket
    loop = asyncio.get_event_loop()
    try:
        pool = _SCAN_POOL or _PPE(max_workers=1)
        discovered = await loop.run_in_executor(pool, _arp_scan_sync, targets)

        # Enrich with hostname (best-effort), but DO NOT save to devices table
        results = []
        for item in discovered:
            ip  = item.get("ip", "")
            mac = item.get("mac", "")
            hostname = ip
            if ip == _SERVER_IP:
                hostname = "IntranetAdmin"
            else:
                try:
                    hostname = _socket.gethostbyaddr(ip)[0]
                except Exception:
                    pass
            results.append({
                "ip":       ip,
                "mac":      mac,
                "status":   "online",
                "hostname": hostname if hostname != ip else None,
            })

        logger.info(f"Scan on '{req.subnet}': {len(results)} hosts found (NOT saved to DB)")
        return results
    except Exception as e:
        logger.error(f"Manual scan error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/scan/ports")
async def scan_ports_endpoint(ip: str):
    """Deep port scan + OS fingerprint + banner grab for a single IP."""
    if not ip:
        raise HTTPException(status_code=400, detail="ip query param is required")

    # Try hostname resolution
    import socket as _socket
    hostname = ip
    try:
        hostname = _socket.gethostbyaddr(ip)[0]
    except Exception:
        pass

    try:
        result = await asyncio.to_thread(scanner.scan_ports, ip)
        result["ip"] = ip
        result["hostname"] = hostname
        return result
    except Exception as e:
        logger.error(f"Port scan error for {ip}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/network-map", response_model=schemas.NetworkMap)
async def get_network_map(db: Session = Depends(get_db)):
    """Returns a rich hierarchical network map: Server → Groupements → Services → Devices"""
    server_ip = _SERVER_IP

    dev_result = await db.execute(select(models.Device))
    devices = dev_result.scalars().all()

    svc_result = await db.execute(select(models.Service))
    services = svc_result.scalars().all()

    grp_result = await db.execute(select(models.Devision))
    groupements = grp_result.scalars().all()

    pos_result = await db.execute(select(models.TopologyPosition))
    positions = {p.node_id: (p.x, p.y) for p in pos_result.scalars().all()}

    nodes = []
    links = []

    # Identify the Server Agent device record natively via hostname
    local_hostname = socket.gethostname()
    server_device = None
    if devices:
        server_device = next((d for d in devices if (d.hostname and d.hostname.lower() == local_hostname.lower()) or 
                                                     d.hostname == "IntranetAdmin" or 
                                                     d.ip_address == server_ip or 
                                                     d.ip_address == "127.0.0.1"), None)
    
    # Helper to get saved position
    def get_pos(node_id):
        return positions.get(node_id, (None, None))

    # Level 1: Root Server Node
    s_px, s_py = get_pos("server")
    nodes.append(schemas.NetworkNode(
        id="server",
        group=1,
        level=1,
        label="IntranetAdmin",
        ip_address=server_device.ip_address if (server_device and server_device.ip_address) else server_ip,
        status=server_device.status if server_device else "offline",
        color="#1890ff",
        mac_address=server_device.mac_address if server_device else None,
        user_name=server_device.user_name if server_device else None,
        os_version=server_device.os_version if server_device else None,
        cpu_usage=server_device.cpu_usage if server_device else None,
        ram_total=server_device.ram_total if server_device else None,
        ram_usage=server_device.ram_usage if server_device else None,
        usb_blocked=server_device.usb_blocked if server_device else False,
        usb_ports_blocked=server_device.usb_ports_blocked if server_device else False,
        rdp_enabled=server_device.rdp_enabled if server_device else True,
        is_isolated=server_device.is_isolated if server_device else False,
        saved_password=server_device.saved_password if server_device else None,
        device_id=server_device.id if server_device else None,
        agent_status=server_device.agent_status if server_device else "offline",
        has_agent=server_device.has_agent if server_device else False,
        pos_x=s_px, pos_y=s_py
    ))

    # Level 2: Devision Nodes
    grp_ids = set()
    for grp in groupements:
        grp_id = f"grp-{grp.id}"
        grp_ids.add(grp_id)
        g_px, g_py = get_pos(grp_id)
        nodes.append(schemas.NetworkNode(
            id=grp_id,
            group=5,
            level=2,
            label=grp.name,
            color=grp.color or "#722ed1",
            status="active",
            parentId="server",
            pos_x=g_px, pos_y=g_py
        ))
        links.append(schemas.NetworkLink(source="server", target=grp_id))

    # Build lookup: groupement_id → (name, color) — done FIRST so services can inherit color
    grp_info = {grp.id: (grp.name, grp.color or '#818cf8') for grp in groupements}
    # Build lookup: service_id → (groupement, svc_color)
    svc_info = {}
    for svc in services:
        inherited_color = grp_info.get(svc.groupement_id, (None, '#13c2c2'))[1] if svc.groupement_id else '#13c2c2'
        svc_color = svc.color if str(svc.color).strip() and svc.color != "#1890ff" else inherited_color
        if svc.groupement_id and svc.groupement_id in grp_info:
            svc_info[svc.id] = (grp_info[svc.groupement_id], svc_color)
        else:
            svc_info[svc.id] = ((None, None), svc_color)

    # Level 3: Service Nodes — color always inherited from parent Groupement
    svc_ids_to_grp = {}
    for svc in services:
        svc_id = f"svc-{svc.id}"
        parent = f"grp-{svc.groupement_id}" if svc.groupement_id and f"grp-{svc.groupement_id}" in grp_ids else "server"
        svc_ids_to_grp[svc.id] = svc_id
        # Inherit color directly from groupement, fallback to teal
        inherited_color = grp_info.get(svc.groupement_id, (None, '#13c2c2'))[1] if svc.groupement_id else '#13c2c2'
        sv_px, sv_py = get_pos(svc_id)
        nodes.append(schemas.NetworkNode(
            id=svc_id,
            group=4,
            level=3,
            label=svc.name,
            color=inherited_color,
            status="active",
            parentId=parent,
            pos_x=sv_px, pos_y=sv_py
        ))
        links.append(schemas.NetworkLink(source=parent, target=svc_id))

    # Level 4: Device Nodes — status dot overlay + groupement color as accent ring
    for dev in devices:
        if server_device and dev.id == server_device.id:
            continue # Skip adding the server device to the PC list

        # Status dot: green=online, grey=offline, red=isolated
        status_color = "#52c41a" if dev.status == "online" else "#8c8c8c"
        if dev.is_isolated:
            status_color = "#ff4d4f"

        # Base/accent color: inherit from groupement (through chain: device→service→groupement)
        grp_lookup, svc_color = svc_info.get(dev.service_id, ((None, None), None))
        grp_name, grp_color = grp_lookup
        
        # Use groupement color as the node accent color;
        accent_color = grp_color or status_color # Fallback to status_color if no groupement color
        # Connect to service if assigned, otherwise directly to server
        parent = svc_ids_to_grp.get(dev.service_id, "server") if dev.service_id else "server"

        d_px, d_py = get_pos(dev.mac_address)
        nodes.append(schemas.NetworkNode(
            id=dev.mac_address,
            group=3,
            level=4,
            label=dev.hostname or dev.ip_address,
            user_name=dev.user_name,
            ip_address=dev.ip_address,
            os_version=dev.os_version,
            cpu_usage=dev.cpu_usage,
            ram_total=dev.ram_total,
            ram_usage=dev.ram_usage,
            service_id=dev.service_id,
            status=dev.status,
            color=accent_color,          # groupement color as accent
            usb_blocked=dev.usb_blocked,
            usb_ports_blocked=dev.usb_ports_blocked,
            rdp_enabled=dev.rdp_enabled,
            is_isolated=dev.is_isolated,
            saved_password=dev.saved_password,
            parentId=parent,
            groupement_name=grp_name,
            groupement_color=grp_color,
            service_color=svc_color,
            mac_address=dev.mac_address,
            device_id=dev.id,
            agent_status=dev.agent_status,
            has_agent=dev.has_agent,
            pos_x=d_px, pos_y=d_py
        ))
        links.append(schemas.NetworkLink(source=parent, target=dev.mac_address))

    return schemas.NetworkMap(nodes=nodes, links=links)

@app.post("/api/topology/positions")
async def update_topology_position(pos: schemas.TopologyPositionUpdate, db: Session = Depends(get_db)):
    """Save or update a node's manual position on the topology map."""
    result = await db.execute(select(models.TopologyPosition).filter(models.TopologyPosition.node_id == pos.node_id))
    db_pos = result.scalar_one_or_none()
    
    if db_pos:
        db_pos.x = pos.x
        db_pos.y = pos.y
    else:
        db_pos = models.TopologyPosition(node_id=pos.node_id, x=pos.x, y=pos.y)
        db.add(db_pos)
    
    await db.commit()
    return {"status": "ok"}

@app.delete("/api/topology/positions")
async def reset_topology_positions(db: Session = Depends(get_db)):
    """Clear ALL manual positions to reset the map layout."""
    await db.execute(delete(models.TopologyPosition))
    await db.commit()
    return {"status": "ok", "message": "Layout reset successfully"}

# ─── Background Scanner: ISOLATED SUBPROCESS approach ────────────────────────
# The ARP scan (Scapy arping) is synchronous and CPU-heavy.
# Running it in asyncio.to_thread still blocks FastAPI's thread pool.
# Solution: spawn a completely separate Python process for each scan,
# so it has ZERO interaction with the FastAPI event loop or thread pool.

def _run_scan_sync(subnet: str) -> list:
    """Pure synchronous scan function — runs in a subprocess worker."""
    try:
        from scapy.all import arping, conf, get_if_addr, get_if_hwaddr
        conf.verb = 0
        from backend.scanner import get_best_interface
        iface = get_best_interface(subnet)
        answered, _ = arping(subnet, iface=iface, verbose=0, timeout=2)
        results = []
        try:
            self_ip  = get_if_addr(iface)
            self_mac = get_if_hwaddr(iface)
            if self_ip and self_ip != "0.0.0.0":
                import ipaddress
                is_targeted = False
                try:
                    if '/' in subnet:
                        if ipaddress.IPv4Address(self_ip) in ipaddress.IPv4Network(subnet):
                            is_targeted = True
                    elif self_ip == subnet:
                        is_targeted = True
                    elif '-' in subnet:
                        if self_ip in scanner.expand_target(subnet):
                            is_targeted = True
                except Exception:
                    pass
                
                if is_targeted:
                    results.append({"ip": self_ip, "mac": self_mac})
        except Exception:
            pass
        for _, rcv in answered:
            if rcv.psrc != self_ip:
                results.append({"ip": rcv.psrc, "mac": rcv.hwsrc})
        return results
    except Exception as e:
        return []

# ─── Startup / Shutdown ───────────────────────────────────────────────────────

@app.on_event("startup")
async def startup_event():
    global _SCAN_POOL, _SERVER_IP, SUBNET_TO_SCAN
    _SCAN_POOL = _PPE(max_workers=1)

    # Ensure database tables exist at startup
    try:
        async with engine.begin() as conn:
            await conn.run_sync(models.Base.metadata.create_all)
        logger.info("[DB] Tables verified/created successfully.")
    except Exception as e:
        logger.error(f"[DB] Error generating tables: {e}")

    # Fire-and-forget: resolve Ethernet adapter AFTER uvicorn is accepting connections
    async def _resolve_ethernet():
        global _SERVER_IP, SUBNET_TO_SCAN
        try:
            ip, subnet = await asyncio.to_thread(get_ethernet_ip)
            _SERVER_IP = ip
            SUBNET_TO_SCAN = subnet
            logger.info(f"Ethernet resolved: {_SERVER_IP}  Subnet: {SUBNET_TO_SCAN}")
        except Exception as e:
            logger.warning(f"Ethernet resolve failed: {e}")

    asyncio.create_task(_resolve_ethernet())

    # ── Heartbeat Monitor: mark agent devices offline if stale ────────────────
    async def _heartbeat_monitor():
        """Fast sync: 30s without heartbeat → offline, check every 3s."""
        OFFLINE_AFTER_SECONDS = 30    # 30 seconds without a heartbeat → offline
        CHECK_INTERVAL = 3            # run every 3 seconds for real-time status

        while True:
            await asyncio.sleep(CHECK_INTERVAL)
            devices_to_broadcast = []
            for attempt in range(5):
                try:
                    async with async_session() as session:
                        cutoff = datetime.utcnow() - timedelta(seconds=OFFLINE_AFTER_SECONDS)
                        result = await session.execute(
                            select(models.Device).filter(
                                models.Device.has_agent == True,
                                models.Device.status == "online",
                                models.Device.last_seen < cutoff,
                            )
                        )
                        stale_devices = result.scalars().all()
                        if stale_devices:
                            for dev in stale_devices:
                                dev.status = "offline"
                                dev.agent_status = "offline"
                                logger.info(f"[Heartbeat] {dev.hostname or dev.ip_address} marked offline (last seen: {dev.last_seen})")
                                devices_to_broadcast.append(schemas.DeviceSchema.from_orm(dev).dict())
                            await session.commit()
                    break # Success, exit retry loop
                except Exception as e:
                    if "locked" in str(e).lower():
                        logger.debug(f"[Heartbeat] DB locked, retrying {attempt+1}/5...")
                        await asyncio.sleep(0.5)
                    else:
                        logger.error(f"[Heartbeat] Error in monitor: {e}")
                        break

            # Broadcast AFTER session block closes and DB lock is released
            for dev_dict in devices_to_broadcast:
                try:
                    await manager.broadcast({"type": "device_update", "device": dev_dict})
                except Exception as e:
                    logger.error(f"[Heartbeat] Broadcast failed: {e}")

    asyncio.create_task(_heartbeat_monitor())

    # ── Periodic ARP subnet scanner: keep non-agent devices' online status updated
    async def _subnet_scanner():
        """
        Periodically ARP-scan the resolved subnet and upsert discovered hosts.
        Determines the primary 'status' (online/offline) for ALL devices based
        strictly on network reachability (ARP).
        """
        SCAN_INTERVAL = 10  # Very frequent for live network status
        while True:
            await asyncio.sleep(SCAN_INTERVAL)
            devices_to_broadcast = []
            for attempt in range(5):
                try:
                    if not SUBNET_TO_SCAN:
                        break # exit retry
                    loop = asyncio.get_event_loop()
                    pool = _SCAN_POOL or _PPE(max_workers=1)
                    discovered = await loop.run_in_executor(pool, _run_scan_sync, SUBNET_TO_SCAN)
                    
                    async with async_session() as session:
                        saved = await upsert_scanned_devices(discovered, session)
                        discovered_ips = {item.get('ip') for item in saved}

                        result = await session.execute(select(models.Device))
                        all_devices = result.scalars().all()
                        updated = []
                        now = datetime.utcnow()
                        for dev in all_devices:
                            if not dev.ip_address:
                                continue

                            is_online = dev.ip_address in discovered_ips

                            if is_online and dev.status != 'online':
                                dev.status = 'online'
                                try:
                                    if not dev.last_seen or (now - dev.last_seen).total_seconds() > 1:
                                        dev.last_seen = now
                                except Exception:
                                    dev.last_seen = now
                                updated.append(dev)
                            elif (not is_online) and (not dev.has_agent) and dev.status != 'offline':
                                dev.status = 'offline'
                                updated.append(dev)

                        if updated:
                            for d in updated:
                                devices_to_broadcast.append(schemas.DeviceSchema.from_orm(d).dict())
                            await session.commit()
                    break # Success
                except Exception as e:
                    if "locked" in str(e).lower():
                        logger.debug(f"[SubnetScanner] DB locked, retrying {attempt+1}/5...")
                        await asyncio.sleep(0.5)
                    else:
                        logger.error(f"[SubnetScanner] Error during periodic scan: {e}")
                        break
            
            # Broadcast AFTER session block closes and DB lock is released
            for dev_dict in devices_to_broadcast:
                try:
                    await manager.broadcast({'type': 'device_update', 'device': dev_dict})
                except Exception as e:
                    logger.error(f"[SubnetScanner] Broadcast failed: {e}")

    asyncio.create_task(_subnet_scanner())
    logger.info(f"IntranetAdmin ready. Initial IP: {_SERVER_IP}. Ethernet resolving in background...")

@app.on_event("shutdown")
async def shutdown_event():
    if _SCAN_POOL:
        _SCAN_POOL.shutdown(wait=False)

if __name__ == "__main__":
    import uvicorn
    logger.info(f"Starting Uvicorn explicitly bound to 0.0.0.0")
    uvicorn.run("backend.main:app", host="0.0.0.0", port=8000, reload=True)
