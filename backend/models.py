from sqlalchemy import Column, Integer, String, DateTime, JSON, Boolean, ForeignKey
from sqlalchemy.orm import relationship
from .database import Base
from datetime import datetime

class Devision(Base):
    __tablename__ = "devisions"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True)
    color = Column(String, default="#1890ff")
    info = Column(String, nullable=True)
    translations = Column(JSON, nullable=True) # { "en": "Name", "ar": "...", ... }
    
    services = relationship("Service", back_populates="groupement_rel", cascade="all, delete-orphan")

class Service(Base):
    __tablename__ = "services"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True)
    groupement = Column(String, default="GMI") # Legacy field, will keep for compatibility or migrate
    groupement_id = Column(Integer, ForeignKey("devisions.id"), nullable=True)
    color = Column(String, default="#1890ff")
    policy_usb_block = Column(Boolean, default=False)
    translations = Column(JSON, nullable=True) # { "en": "Name", "ar": "...", ... }
    
    groupement_rel = relationship("Devision", back_populates="services")
    devices = relationship("Device", back_populates="service")

class CommandQueue(Base):
    __tablename__ = "command_queue"
    
    id = Column(Integer, primary_key=True, index=True)
    target_mac = Column(String, index=True)
    command = Column(String)
    params = Column(JSON, default={})
    status = Column(String, default="pending") # pending, executed, failed
    created_at = Column(DateTime, default=datetime.utcnow)

class Device(Base):
    __tablename__ = "devices"

    id = Column(Integer, primary_key=True, index=True)
    hostname = Column(String, index=True)
    user_name = Column(String, nullable=True)
    ip_address = Column(String, index=True)
    mac_address = Column(String, unique=True, index=True)
    last_seen = Column(DateTime, default=datetime.utcnow)
    status = Column(String, default="offline")
    
    # Extended Info
    os_version = Column(String, default="Unknown")
    cpu_usage = Column(Integer, default=0)
    ram_total = Column(String, default="0GB")
    ram_usage = Column(Integer, default=0)
    
    # Security Status
    usb_blocked = Column(Boolean, default=False)
    usb_ports_blocked = Column(Boolean, default=False)
    is_isolated = Column(Boolean, default=False)
    rdp_enabled = Column(Boolean, default=False)
    has_agent = Column(Boolean, default=False)  # True only when device has reported via the agent
    group_tag = Column(String, nullable=True) # e.g. "GMI", "GCS"
    saved_password = Column(String, nullable=True)
    
    last_command_id = Column(Integer, nullable=True)
    service_id = Column(Integer, ForeignKey("services.id"), nullable=True)
    service = relationship("Service", back_populates="devices")
    
    inventory = relationship("Inventory", back_populates="device", cascade="all, delete-orphan")

class Inventory(Base):
    __tablename__ = "inventory"
    
    id = Column(Integer, primary_key=True, index=True)
    device_id = Column(Integer, ForeignKey("devices.id"))
    display_name = Column(String)
    display_version = Column(String, nullable=True)
    install_date = Column(String, nullable=True)
    
    device = relationship("Device", back_populates="inventory")

class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    hashed_password = Column(String)

class RDPSession(Base):
    __tablename__ = "rdp_sessions"
    
    id = Column(Integer, primary_key=True, index=True)
    admin_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    target_pc_id = Column(Integer, ForeignKey("devices.id"))
    start_time = Column(DateTime, default=datetime.utcnow)


class ScanResult(Base):
    __tablename__ = "scan_results"

    id = Column(Integer, primary_key=True, index=True)
    scan_time = Column(DateTime, default=datetime.utcnow)
    discovered_devices = Column(JSON)

class TopologyPosition(Base):
    __tablename__ = "topology_positions"
    node_id = Column(String, primary_key=True, index=True)
    x = Column(Integer)
    y = Column(Integer)
