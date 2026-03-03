from scapy.all import arping, conf
from sqlalchemy.ext.asyncio import AsyncSession
import asyncio
from . import models, database
import json
from datetime import datetime
import logging

# Suppress Scapy warnings
logging.getLogger("scapy.runtime").setLevel(logging.ERROR)

logger = logging.getLogger(__name__)

def expand_target(target: str) -> list:
    """
    Normalize any of these formats into a list of targets Scapy can handle:
      - 192.168.1.0/24    → one CIDR string (Scapy handles it natively)
      - 192.168.1.5       → single IP string
      - 192.168.1.1-50    → 50 individual IP strings
      - 192.168.1.1-192.168.1.50 → range of IPs
    Returns a list; usually 1 element (CIDR/single), many for ranges.
    """
    import ipaddress
    target = target.strip()

    # CIDR notation
    if '/' in target:
        return [target]

    # Dash range: 192.168.1.1-50 or 192.168.1.1-192.168.1.50
    if '-' in target:
        parts = target.split('-')
        start_str = parts[0].strip()
        end_str   = parts[1].strip()
        try:
            start_ip = ipaddress.IPv4Address(start_str)
            # If end is just a host octet (e.g. "50"), build the full IP
            if '.' not in end_str:
                prefix = '.'.join(start_str.split('.')[:3])
                end_ip = ipaddress.IPv4Address(f"{prefix}.{end_str}")
            else:
                end_ip = ipaddress.IPv4Address(end_str)
            ips = []
            current = start_ip
            while current <= end_ip:
                ips.append(str(current))
                current += 1
            return ips
        except Exception:
            pass   # fall through to single-IP

    # Single IP
    return [target]

def is_valid_interface_desc(desc):
    desc = desc.lower()
    # Must be Ethernet/Intel/Realtek/Gigabit
    if not ('ethernet' in desc or 'gigabit' in desc or 'realtek' in desc or 'intel' in desc):
        return False
        
    # Must NOT be Virtual
    if 'virtual' in desc or 'vmware' in desc or 'vbox' in desc or 'hyper-v' in desc:
        return False
        
    # Must NOT be Wireless
    if 'wi-fi' in desc or 'wireless' in desc or 'wlan' in desc or '802.11' in desc or 'bluetooth' in desc:
        return False

    return True

def get_best_interface(target_subnet: str):
    """
    Selects the best network interface for scanning.
    Prioritizes:
    1. Interface matching the target subnet prefix AND is a valid Ethernet interface.
    2. Any valid Physical Ethernet interface.
    3. Default interface (only if it passes validation, otherwise warn).
    """
    from scapy.all import get_if_list, get_if_addr, conf
    
    target_prefix = ".".join(target_subnet.split('.')[:3])
    
    # 0. Build a map of interface names to descriptions for Windows
    iface_descs = {}
    try:
        for iface_name, iface_obj in conf.ifaces.items():
            # pcap_name or name or description
            key = iface_obj.pcap_name if hasattr(iface_obj, 'pcap_name') else iface_obj.name
            iface_descs[key] = getattr(iface_obj, 'description', '').lower()
            if hasattr(iface_obj, 'name'):
                 iface_descs[iface_obj.name] = getattr(iface_obj, 'description', '').lower()
    except:
        pass

    interfaces = get_if_list()
    
    # 1. Look for a prefix match THAT IS ALSO VALID
    for iface in interfaces:
        try:
            ip = get_if_addr(iface)
            if ip and ip.startswith(target_prefix):
                # Validate description if we can find it
                desc = iface_descs.get(iface, "")
                # If we have a description, strictly validate it. 
                # If we don't (Linux/Mac sometimes), we might trust the prefix, but for Windows we usually have it.
                if desc and not is_valid_interface_desc(desc):
                     logger.warning(f"Ignored prefix-matching interface {iface} because it is not valid Ethernet ({desc})")
                     continue
                
                logger.debug(f"Valid prefix match found: {iface} ({ip}) matches {target_prefix}")
                return iface
        except:
            continue

    # 2. Look for physical Ethernet (Realtek, Intel, etc.) if no valid prefix match
    try:
        for iface_name, iface_obj in conf.ifaces.items():
            desc = getattr(iface_obj, 'description', '').lower()
            if is_valid_interface_desc(desc):
                logger.info(f"Prioritizing physical Ethernet interface: {iface_obj.name} ({desc})")
                return iface_obj.libnet_name if hasattr(iface_obj, 'libnet_name') else iface_obj.pcap_name
    except Exception as e:
        logger.warning(f"Error while checking physical interfaces: {e}")

    logger.warning(f"No specific valid interface found for {target_subnet}. Using default: {conf.iface}")
    return conf.iface

async def run_scan(subnet: str):
    logger.info(f"Starting ARP scan on {subnet}...")
    print(f"\n[SCAN] --- Starting ARP scan on {subnet} ---", flush=True)
    try:
        from scapy.all import arping, conf
        conf.verb = 0
        
        selected_iface = get_best_interface(subnet)
        logger.info(f"Using interface: {selected_iface}")

        # Scapy's arping is synchronous, run in thread to avoid blocking event loop
        answered, _ = await asyncio.to_thread(arping, subnet, iface=selected_iface, verbose=0, timeout=2)
        
        discovered = []
        
        # 0. Inject Self (Scanner Host) only if it matches the requested subnet
        try:
            from scapy.all import get_if_addr, get_if_hwaddr
            self_ip = get_if_addr(selected_iface)
            self_mac = get_if_hwaddr(selected_iface)
            if self_ip and self_ip != "0.0.0.0" and self_mac:
                import ipaddress
                is_targeted = False
                try:
                    if '/' in subnet: # CIDR
                        if ipaddress.IPv4Address(self_ip) in ipaddress.IPv4Network(subnet):
                            is_targeted = True
                    elif self_ip == subnet:
                        is_targeted = True
                    elif '-' in subnet: # Range
                        if self_ip in expand_target(subnet):
                            is_targeted = True
                except Exception:
                    pass
                
                if is_targeted:
                    discovered.append({
                        "ip": self_ip,
                        "mac": self_mac
                    })
        except Exception as e:
            logger.warning(f"Could not inject self into scan results: {e}")

        for sent, received in answered:
            # Avoid duplicates if self responded
            if received.psrc == self_ip:
                continue
                
            # print(f"  [+] Found device: IP={received.psrc} MAC={received.hwsrc}", flush=True)
            discovered.append({
                "ip": received.psrc,
                "mac": received.hwsrc
            })
            
            # Optional: Update Device table if not exists? 
            # For now, let's just log it to ScanResult
        
        logger.info(f"Scan complete. Found {len(discovered)} devices.")
        print(f"[SCAN] --- Scan complete. Found {len(discovered)} devices ---\n", flush=True)
        
        return discovered
        
    except Exception as e:
        logger.error(f"ARP scan failed: {e}")
        print(f"[SCAN] ERROR: ARP scan failed: {e}", flush=True)
        return []

import socket
import threading
from queue import Queue

def get_banner(ip, port):
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        s.settimeout(1.5)
        s.connect((ip, port))
        
        # Send some bytes for HTTP/Generic to trigger response
        if port == 80 or port == 8080:
            s.send(b'HEAD / HTTP/1.0\r\n\r\n')
        
        banner = s.recv(1024).decode('utf-8', errors='ignore').strip()
        s.close()
        return banner
    except:
        return None

def get_os_from_ttl(ip):
    try:
        from scapy.all import sr1, IP, ICMP
        # Send ICMP Echo Request
        ans = sr1(IP(dst=ip)/ICMP(), timeout=2, verbose=0)
        if ans:
            ttl = ans.ttl
            # Heuristic for OS guessing based on initial TTL
            if ttl <= 64:
                return "Linux/Unix/Mac"
            elif ttl <= 128:
                return "Windows"
            elif ttl <= 255:
                return "Cisco/Network Device"
    except Exception as e:
        logger.warning(f"OS TTL detection failed: {e}")
    return "Unknown"

def scan_ports(target_ip: str):
    """
    Scans common ports on the target IP using sockets.
    Returns a dictionary of open ports, potential service names, and OS info.
    """
    logger.info(f"Starting deep scan on {target_ip}...")
    
    # Common ports to scan
    common_ports = {
        21: "FTP", 22: "SSH", 23: "Telnet", 25: "SMTP", 
        80: "HTTP", 135: "RPC", 139: "NetBIOS", 443: "HTTPS", 
        445: "SMB", 3306: "MySQL", 3389: "RDP", 
        8080: "HTTP-Proxy"
    }
    
    open_ports = []
    banners = []
    
    def check_port(ip, port, result_list):
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(1.0)
        try:
            result = sock.connect_ex((ip, port))
            if result == 0:
                service = common_ports.get(port, "Unknown")
                result_list.append({"port": port, "service": service})
                
                # Banner Grab for specific ports
                if port in [21, 22, 23, 25, 80, 8080]:
                    b = get_banner(ip, port)
                    if b:
                        banners.append(f"{service}: {b[:50]}") # Truncate long banners
        except:
            pass
        finally:
            sock.close()
            
    # Threaded Port Scan
    threads = []
    results = []
    
    for port in common_ports.keys():
        t = threading.Thread(target=check_port, args=(target_ip, port, results))
        threads.append(t)
        t.start()
        
    for t in threads:
        t.join()
        
    # Analyze OS
    os_guess = get_os_from_ttl(target_ip)
    
    # Refine OS guess with Banners/Ports
    ports_nums = [r['port'] for r in results]
    
    # SMB/RDP usually means Windows
    # If explicit ports are found, we can be very confident it is Windows
    if 445 in ports_nums or 139 in ports_nums or 3389 in ports_nums:
        if os_guess == "Unknown" or os_guess == "Linux/Unix/Mac":
             # Override TTL guess if we see strong Windows indicators
             os_guess = "Windows"

    # SSH often leaks OS version in banner e.g. "Ubuntu"
    version_info = ""
    for b in banners:
        if "Ubuntu" in b:
            os_guess = "Linux (Ubuntu)"
            version_info = b
        elif "Debian" in b:
            os_guess = "Linux (Debian)"
        elif "Microsoft" in b or "Windows" in b:
            os_guess = "Windows"
            
    logger.info(f"Deep scan for {target_ip}: {len(results)} ports, OS: {os_guess}")
    
    # Sort ports
    results.sort(key=lambda x: x['port'])
    
    return {
        "open_ports": results,
        "os_guess": os_guess,
        "banners": banners,
        "version_info": version_info
    }
