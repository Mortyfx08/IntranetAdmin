import psutil
import socket
import logging
from scapy.all import conf

logger = logging.getLogger(__name__)

def get_physical_ip():
    """
    1. Identify Default Gateway: Use scapy.all.conf.route.route("8.8.8.8")
    2. Filter via psutil:
        - Iterate through psutil.net_if_stats().
        - Only select interfaces where isup is True AND the speed is > 100Mbps.
        - Cross-reference with psutil.net_if_addrs() to get the IPv4.
        - Specifically filter OUT any name containing: "Wi-Fi", "Wireless", "Virtual", "Hyper-V", "vEthernet", "Software", "Loopback".
    """
    
    # Optional: We identify the route, but psutil gives us guaranteed details about whether it's virtual/wireless/etc.
    try:
        route_iface, gw_ip, route_self_ip = conf.route.route("8.8.8.8")
    except Exception:
        route_iface, gw_ip, route_self_ip = None, None, None

    stats = psutil.net_if_stats()
    addrs = psutil.net_if_addrs()
    
    skip_keywords = ["wi-fi", "wireless", "virtual", "hyper-v", "vethernet", "software", "loopback", "wlan", "802.11"]
    
    candidates = []
    
    for iface_name, stat in stats.items():
        iface_lower = iface_name.lower()
        if not stat.isup:
            continue
            
        if any(kw in iface_lower for kw in skip_keywords):
            continue
            
        # Distinguish physical from virtual/crap by speed > 100
        if stat.speed <= 100 and stat.speed != 0: 
            continue
            
        # Get IPv4 address
        ip = None
        if iface_name in addrs:
            for addr in addrs[iface_name]:
                if addr.family == socket.AF_INET:
                    ip = addr.address
                    break
        
        if not ip or ip == "127.0.0.1" or ip == "0.0.0.0" or ip.startswith("169.254."):
            continue
            
        # Score prioritizing if it matches scapy gateway
        score = stat.speed
        if route_self_ip and ip == route_self_ip:
            score += 10000  # Gateway naturally gets highest priority
            
        candidates.append((score, ip, iface_name))
        
    if candidates:
        # Sort by best fit
        candidates.sort(key=lambda x: x[0], reverse=True)
        best_ip = candidates[0][1]
        assert best_ip is not None
        logger.info(f"Discovered REAL Physical Ethernet IP: {best_ip} on interface {candidates[0][2]}")
        octets = best_ip.split('.')
        subnet = f"{octets[0]}.{octets[1]}.{octets[2]}.0/24" if len(octets) == 4 else "127.0.0.1/32"
        return best_ip, subnet
        
    # If our strict rules failed, fallback to the guaranteed routable socket IP
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        fallback_ip = s.getsockname()[0]
        s.close()
        
        if fallback_ip and fallback_ip not in ["0.0.0.0", "127.0.0.1"] and not fallback_ip.startswith("169.254."):
            logger.info(f"Fallback to strictly routable Socket IP: {fallback_ip}")
            octets = fallback_ip.split('.')
            subnet = f"{octets[0]}.{octets[1]}.{octets[2]}.0/24" if len(octets) == 4 else "127.0.0.1/32"
            return fallback_ip, subnet
    except Exception:
        pass
        
    raise RuntimeError("Could not determine a valid physical Ethernet IP address. Will not bind to 127.0.0.1.")
