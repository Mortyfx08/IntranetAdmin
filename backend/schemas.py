from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from datetime import datetime

class DevisionBase(BaseModel):
    name: str
    color: str = "#1890ff"
    info: Optional[str] = None
    translations: Optional[Dict[str, str]] = None

class DevisionCreate(DevisionBase):
    pass

class Devision(DevisionBase):
    id: int
    class Config:
        from_attributes = True

class ServiceBase(BaseModel):
    name: str
    groupement: str = "GMI"
    groupement_id: Optional[int] = None
    color: str = "#1890ff"
    policy_usb_block: bool = False
    translations: Optional[Dict[str, str]] = None
    # policy_internet_block removed

class ServiceCreate(ServiceBase):
    pass

class Service(ServiceBase):
    id: int
    class Config:
        from_attributes = True

class CommandCreate(BaseModel):
    target_mac: Optional[str] = None
    command: str
    params: Dict[str, Any] = {}

class CommandResult(BaseModel):
    command_id: int
    status: str  # executed, failed
    output: Optional[str] = None

class InventoryBase(BaseModel):
    display_name: str
    display_version: Optional[str] = None
    install_date: Optional[str] = None

class InventoryCreate(InventoryBase):
    device_id: int

class Inventory(InventoryBase):
    id: int
    class Config:
        from_attributes = True

class AgentReport(BaseModel):
    hostname: str
    user_name: Optional[str] = None
    ip_address: str
    mac_address: str
    status: str
    os_version: str = "Unknown"
    cpu_usage: int = 0
    ram_total: str = "0GB"
    ram_usage: int = 0
    usb_blocked: bool = False
    usb_ports_blocked: bool = False
    is_isolated: bool = False
    rdp_enabled: bool = False
    agent_status: str = "offline"

class InventoryReport(BaseModel):
    mac_address: str
    inventory: List[InventoryBase]

class DeviceSchema(AgentReport):
    id: int
    last_seen: datetime
    service_id: Optional[int] = None
    saved_password: Optional[str] = None
    has_agent: bool = False
    
    class Config:
        from_attributes = True

class DeviceCredentialsUpdate(BaseModel):
    user_name: str
    password: str


class NetworkNode(BaseModel):
    id: str
    group: int  # 1=Server, 3=PC/Device, 4=Service, 5=Devision
    level: int
    label: str
    mac_address: Optional[str] = None
    user_name: Optional[str] = None
    ip_address: Optional[str] = None
    os_version: Optional[str] = None
    cpu_usage: Optional[int] = None
    ram_total: Optional[str] = None
    ram_usage: Optional[int] = None
    service_id: Optional[int] = None
    color: Optional[str] = None
    status: Optional[str] = None
    usb_blocked: Optional[bool] = None
    usb_ports_blocked: Optional[bool] = None
    rdp_enabled: Optional[bool] = None
    parentId: Optional[str] = None
    # Group badge info for PC nodes
    groupement_name: Optional[str] = None
    groupement_color: Optional[str] = None
    saved_password: Optional[str] = None
    is_isolated: Optional[bool] = None
    has_agent: Optional[bool] = None
    agent_status: Optional[str] = None
    service_color: Optional[str] = None
    # DB integer id for device nodes (needed for RDP revoke etc.)
    device_id: Optional[int] = None
    # Position persistence
    pos_x: Optional[float] = None
    pos_y: Optional[float] = None

class NetworkLink(BaseModel):
    source: str
    target: str

class UserLogin(BaseModel):
    username: str
    password: str

class UserSchema(BaseModel):
    id: int
    username: str
    class Config:
        from_attributes = True

class NetworkMap(BaseModel):
    nodes: List[NetworkNode]
    links: List[NetworkLink]

class RDPSessionBase(BaseModel):
    admin_id: Optional[int] = None
    target_pc_id: int
    start_time: Optional[datetime] = None

class RDPSessionCreate(RDPSessionBase):
    pass

class RDPSession(RDPSessionBase):
    id: int
    class Config:
        from_attributes = True

class TopologyPositionUpdate(BaseModel):
    node_id: str
    x: int
    y: int
