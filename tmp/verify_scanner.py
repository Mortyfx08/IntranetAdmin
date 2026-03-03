import ipaddress

def expand_target(target: str) -> list:
    target = target.strip()
    if '/' in target:
        return [target]
    if '-' in target:
        parts = target.split('-')
        start_str = parts[0].strip()
        end_str   = parts[1].strip()
        try:
            start_ip = ipaddress.IPv4Address(start_str)
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
            pass
    return [target]

def test_logic(targets, self_ip="192.168.1.5"):
    results = []
    # Implementation of the fix:
    try:
        if self_ip and self_ip != "0.0.0.0":
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
                        if self_ip in expand_target(t):
                            is_targeted = True
                            break
                except Exception:
                    continue
            
            if is_targeted:
                results.append({"ip": self_ip, "status": "online"})
    except Exception as e:
        print(f"Error in logic: {e}")
    
    return results

# Test Cases
print("Test Case 1: Targeted single IP (NOT server)")
targets = expand_target("192.168.1.10")
res = test_logic(targets)
ips = [r['ip'] for r in res]
print(f"Targets: {targets}, Results Found: {ips}")
assert "192.168.1.5" not in ips

print("\nTest Case 2: Targeted single IP (IS server)")
targets = expand_target("192.168.1.5")
res = test_logic(targets)
ips = [r['ip'] for r in res]
print(f"Targets: {targets}, Results Found: {ips}")
assert "192.168.1.5" in ips

print("\nTest Case 3: Targeted CIDR (Includes server)")
targets = expand_target("192.168.1.0/24")
res = test_logic(targets)
ips = [r['ip'] for r in res]
print(f"Targets: {targets}, Results Found: {ips}")
assert "192.168.1.5" in ips

print("\nTest Case 4: Targeted CIDR (Excludes server)")
targets = expand_target("10.0.0.0/24")
res = test_logic(targets)
ips = [r['ip'] for r in res]
print(f"Targets: {targets}, Results Found: {ips}")
assert "192.168.1.5" not in ips

print("\nTest Case 5: Targeted Range (Excludes server)")
targets = expand_target("192.168.1.10-20")
res = test_logic(targets)
ips = [r['ip'] for r in res]
print(f"Targets: {targets}, Results Found: {ips}")
assert "192.168.1.5" not in ips

print("\nAll logical checks passed!")
