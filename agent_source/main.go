package main

import (
	"bytes"
	"encoding/json"
	"flag"
	"fmt"
	"math/rand"
	"net"
	"net/http"
	"os"
	"os/exec"
	"os/signal"
	"path/filepath"
	"runtime"
	"strings"
	"syscall"
	"time"
	"unsafe"
)

// Config
const (
	SharedSecret   = "netsentry-secret"
	DefaultServer  = "http://192.168.0.18:8000/api/report"
	NormalInterval = 5 * time.Second
	FastInterval   = 1 * time.Second // For rapid updates after action
)

// AgentReport matches backend schema
type AgentReport struct {
	Hostname   string `json:"hostname"`
	UserName   string `json:"user_name"`
	IPAddress  string `json:"ip_address"`
	MacAddress string `json:"mac_address"`
	Status     string `json:"status"`
	OSVersion  string `json:"os_version"`
	CpuUsage   int    `json:"cpu_usage"`
	RamTotal   string `json:"ram_total"`
	RamUsage   int    `json:"ram_usage"`
	// InternetBlocked Removed
	UsbBlocked      bool `json:"usb_blocked"`       // Maps to "Block Storage" (HDD/Phones)
	UsbPortsBlocked bool `json:"usb_ports_blocked"` // Maps to "Block USB Keys" (Removable Disks)
	RdpEnabled      bool `json:"rdp_enabled"`
}

// Command from backend
type Command struct {
	ID      int                    `json:"id"`
	Command string                 `json:"command"`
	Params  map[string]interface{} `json:"params"`
}

type CommandResult struct {
	CommandID int    `json:"command_id"`
	Status    string `json:"status"` // executed, failed
	Output    string `json:"output"`
}

type ReportResponse struct {
	Status   string    `json:"status"`
	Commands []Command `json:"commands"`
}

var (
	hostname         string
	macAddr          string
	ipAddr           string
	serverURL        string
	osVersion        string
	simulateOS       string
	manualMac        string
	currentState     AgentReport
	rdpSessionActive bool
	rdpTimer         *time.Timer
)

// --- Registry Helpers (Manual DLL Loading) ---

var (
	modadvapi32          = syscall.NewLazyDLL("advapi32.dll")
	procRegCreateKeyExW  = modadvapi32.NewProc("RegCreateKeyExW")
	procRegOpenKeyExW    = modadvapi32.NewProc("RegOpenKeyExW")
	procRegCloseKey      = modadvapi32.NewProc("RegCloseKey")
	procRegSetValueExW   = modadvapi32.NewProc("RegSetValueExW")
	procRegQueryValueExW = modadvapi32.NewProc("RegQueryValueExW")
	procRegDeleteValueW  = modadvapi32.NewProc("RegDeleteValueW")

	modkernel32              = syscall.NewLazyDLL("kernel32.dll")
	procGlobalMemoryStatusEx = modkernel32.NewProc("GlobalMemoryStatusEx")
)

type memoryStatusEx struct {
	cbSize                  uint32
	dwMemoryLoad            uint32
	ullTotalPhys            uint64
	ullAvailPhys            uint64
	ullTotalPageFile        uint64
	ullAvailPageFile        uint64
	ullTotalVirtual         uint64
	ullAvailVirtual         uint64
	ullAvailExtendedVirtual uint64
}

const (
	HKEY_LOCAL_MACHINE = 0x80000002
	HKEY_CURRENT_USER  = 0x80000001
	KEY_READ           = 0x20019
	KEY_ALL_ACCESS     = 0xF003F
	REG_SZ             = 1
	REG_DWORD          = 4
)

func main() {
	// Parse Flags
	flag.StringVar(&serverURL, "server", DefaultServer, "Backend URL")
	flag.StringVar(&simulateOS, "os-version", "", "Simulate OS Version (e.g., 'Windows 7')")
	flag.StringVar(&manualMac, "mac", "", "Manually set MAC Address")
	flag.Parse()

	fmt.Println("NetSentry Agent v3.0 Starting...")
	fmt.Printf("Server: %s\n", serverURL)

	// 1. Ensure Persistence (Run Forever)
	ensurePersistence()

	if simulateOS != "" {
		fmt.Printf("Simulating OS: %s\n", simulateOS)
	}

	// Graceful Shutdown Handler
	c := make(chan os.Signal, 1)
	signal.Notify(c, os.Interrupt, syscall.SIGTERM)
	go func() {
		<-c
		fmt.Println("\nReceived termination signal. Sending offline status...")
		sendOneShotStatus("offline")
		os.Exit(0)
	}()

	// Note: initSystemInfo() is no longer called here.
	// We gather it dynamically in checkIn() to ensure we pick up network changes.

	// Initial Check-in
	checkIn()

	// 2. Heartbeat with Jitter & Watchdog
	go func() {
		for {
			baseInterval := 5 * time.Second
			// ±1s randomized jitter
			jitter := time.Duration(rand.Intn(3)-1) * time.Second
			nextSleep := baseInterval + jitter

			fmt.Printf("[%s] Next heartbeat in %v\n", time.Now().Format("15:04:05"), nextSleep)
			time.Sleep(nextSleep)

			checkIn()
		}
	}()

	// Keep main alive
	select {}
}

func ensurePersistence() {
	exePath, err := os.Executable()
	if err != nil {
		fmt.Println("Error getting executable path:", err)
		return
	}
	// Make sure we use the absolute path
	absPath, err := filepath.Abs(exePath)
	if err != nil {
		absPath = exePath
	}

	// Prepare the command (Path + Arguments)
	// We wrap path in quotes to handle spaces
	cmd := fmt.Sprintf(`"%s" --server "%s"`, absPath, serverURL)

	keyPath := `Software\Microsoft\Windows\CurrentVersion\Run`
	k, err := openKey(HKEY_LOCAL_MACHINE, keyPath, KEY_ALL_ACCESS)
	if err != nil {
		k, err = createKey(HKEY_LOCAL_MACHINE, keyPath)
		if err != nil {
			fmt.Println("Error opening/creating Registry Run key (requires Admin):", err)
			return
		}
	}
	defer regCloseKey(k)

	// Check if already correct
	val, err := getStringValue(k, "NetSentryAgent")
	if err == nil && val == cmd {
		return
	}

	// Set value
	err = setStringValue(k, "NetSentryAgent", cmd)
	if err != nil {
		fmt.Println("Error setting persistence:", err)
	} else {
		fmt.Printf("Persistence updated: %s\n", cmd)
	}
}

func refreshNetworkInfo() {
	h, _ := os.Hostname()
	hostname = h

	if simulateOS != "" {
		osVersion = simulateOS
	} else {
		osVersion = getRealOSVersion()
	}

	// Dynamic IP and MAC
	ipAddr = getLocalIP()
	if manualMac != "" {
		macAddr = manualMac
	} else {
		macAddr = getMacForIP(ipAddr)
	}

	fmt.Printf("[%s] Detected: IP=%s MAC=%s\n", time.Now().Format("15:04:05"), ipAddr, macAddr)
}

func initSystemInfo() {
	h, _ := os.Hostname()
	hostname = h

	if simulateOS != "" {
		osVersion = simulateOS
	} else {
		osVersion = getRealOSVersion()
	}
}

var failureCounter int

func checkIn() {
	refreshNetworkInfo()
	ramTotal, ramUsage := getRAMInfo()

	currentState = AgentReport{
		Hostname:        hostname,
		UserName:        getUserName(),
		IPAddress:       ipAddr,
		MacAddress:      macAddr,
		Status:          "online",
		OSVersion:       osVersion,
		CpuUsage:        getCPUUsage(),
		RamTotal:        ramTotal,
		RamUsage:        ramUsage,
		UsbBlocked:      checkWpdBlocked(),
		UsbPortsBlocked: checkRemovableBlocked(),
		RdpEnabled:      isRDPListening(),
	}

	jsonData, _ := json.Marshal(currentState)
	req, err := http.NewRequest("POST", serverURL, bytes.NewBuffer(jsonData))
	if err != nil {
		handleFailure()
		return
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Shared-Secret", SharedSecret)

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		fmt.Printf("Error contacting server: %v\n", err)
		handleFailure()
		return
	}
	defer resp.Body.Close()

	failureCounter = 0 // Reset on success

	var response ReportResponse
	if err := json.NewDecoder(resp.Body).Decode(&response); err != nil {
		fmt.Printf("Error decoding response: %v\n", err)
		return
	}

	shouldForceUpdate := false
	for _, cmd := range response.Commands {
		fmt.Printf("Received Command: %s (ID: %d)\n", cmd.Command, cmd.ID)
		status, output := executeCommand(cmd)
		reportCommandResult(cmd.ID, status, output)
		if status == "executed" {
			shouldForceUpdate = true
		}
	}

	if shouldForceUpdate {
		fmt.Println("State changed. Sending immediate update...")
		time.Sleep(500 * time.Millisecond)
		checkIn()
	}
}

func handleFailure() {
	failureCounter++
	fmt.Printf("[%s] Connection failure #%d\n", time.Now().Format("15:04:05"), failureCounter)
	if failureCounter >= 5 {
		selfHeal()
	}
}

func selfHeal() {
	fmt.Println("!!! Watchdog triggered: 5 consecutive failures. Attempting self-healing...")
	failureCounter = 0
	refreshNetworkInfo()
}

func reportCommandResult(id int, status string, output string) {
	result := CommandResult{
		CommandID: id,
		Status:    status,
		Output:    output,
	}

	jsonData, _ := json.Marshal(result)
	url := strings.Replace(serverURL, "/report", "/command/result", 1)
	req, err := http.NewRequest("POST", url, bytes.NewBuffer(jsonData))
	if err != nil {
		fmt.Printf("reportCommandResult: failed to create request: %v\n", err)
		return
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Shared-Secret", SharedSecret)

	client := &http.Client{Timeout: 5 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		fmt.Printf("reportCommandResult: POST failed: %v\n", err)
		return
	}
	resp.Body.Close()
	fmt.Printf("Command Result Reported: %s\n", status)
}

// executeCommand returns (status, output)
func executeCommand(cmd Command) (string, string) {
	status := "executed"
	output := "Action completed successfully"
	if cmd.Params == nil {
		cmd.Params = make(map[string]interface{})
	}
	enabled, _ := cmd.Params["enabled"].(bool)

	switch cmd.Command {
	case "BLOCK_STORAGE":
		setWpdBlocked(enabled)

	case "BLOCK_USB_PORTS":
		setRemovableBlocked(enabled)

	case "ISOLATE":
		isolateNode(enabled)

	case "ENABLE_RDP":
		enableRDP()

	case "DISABLE_RDP":
		disableRDP()

	case "CHANGE_PASSWORD":
		user, _ := cmd.Params["user"].(string)
		pass, _ := cmd.Params["pass"].(string)
		if err := changePassword(user, pass); err != nil {
			status = "failed"
			output = err.Error()
		}

	case "GET_INVENTORY":
		reportInventory()

	case "REBOOT":
		sendOneShotStatus("offline")
		c := exec.Command("shutdown", "/r", "/f", "/t", "5")
		hideWindow(c)
		c.Start()

	case "SHUTDOWN":
		sendOneShotStatus("offline")
		c := exec.Command("shutdown", "/s", "/f", "/t", "5")
		hideWindow(c)
		c.Start()

	default:
		fmt.Printf("Unknown command ignored: %s\n", cmd.Command)
		status = "failed"
		output = "Unknown command"
	}

	return status, output
}

func changePassword(user, pass string) error {
	if user == "" || pass == "" {
		fmt.Println("CHANGE_PASSWORD skipped: user or pass empty")
		return fmt.Errorf("user or password empty")
	}
	fmt.Printf("Changing password for user: %s\n", user)
	return runCmd("net", "user", user, pass)
}

func isRDPListening() bool {
	conn, err := net.DialTimeout("tcp", "127.0.0.1:3389", 200*time.Millisecond)
	if err != nil {
		return false
	}
	conn.Close()
	return true
}

func enableRDP() {
	fmt.Println("Enabling RDP...")
	keyPath := `System\CurrentControlSet\Control\Terminal Server`
	k, err := openKey(HKEY_LOCAL_MACHINE, keyPath, KEY_ALL_ACCESS)
	if err == nil {
		setDWordValue(k, "fDenyTSConnections", 0)
		regCloseKey(k)
	}

	// Disable NLA
	nlaKeyPath := `System\CurrentControlSet\Control\Terminal Server\WinStations\RDP-Tcp`
	nlaK, err := openKey(HKEY_LOCAL_MACHINE, nlaKeyPath, KEY_ALL_ACCESS)
	if err == nil {
		setDWordValue(nlaK, "UserAuthentication", 0)
		regCloseKey(nlaK)
	}

	// Restore Firewall Rules
	runCmd("netsh", "advfirewall", "firewall", "add", "rule", "name=Open_RDP_3389", "dir=in", "action=allow", "protocol=TCP", "localport=3389")

	rdpSessionActive = true

	// Phase 1: Auto-Cleanup (Session Watcher) - 2 Hour Timeout
	if rdpTimer != nil {
		rdpTimer.Stop()
	}
	rdpTimer = time.AfterFunc(2*time.Hour, func() {
		if rdpSessionActive {
			fmt.Println("RDP Session Watcher: Timeout reached, auto-disabling RDP...")
			disableRDP()
			// Force an immediate state report after auto-disabling
			currentState.RdpEnabled = false
			sendOneShotStatus("online")
		}
	})
}

func disableRDP() {
	fmt.Println("Disabling RDP...")
	keyPath := `System\CurrentControlSet\Control\Terminal Server`
	k, err := openKey(HKEY_LOCAL_MACHINE, keyPath, KEY_ALL_ACCESS)
	if err == nil {
		setDWordValue(k, "fDenyTSConnections", 1)
		regCloseKey(k)
	}

	nlaKeyPath := `System\CurrentControlSet\Control\Terminal Server\WinStations\RDP-Tcp`
	nlaK, err := openKey(HKEY_LOCAL_MACHINE, nlaKeyPath, KEY_ALL_ACCESS)
	if err == nil {
		setDWordValue(nlaK, "UserAuthentication", 1)
		regCloseKey(nlaK)
	}

	runCmd("netsh", "advfirewall", "firewall", "delete", "rule", "name=Open_RDP_3389")

	rdpSessionActive = false
	if rdpTimer != nil {
		rdpTimer.Stop()
	}

	// Kill RDP clipboard
	exec.Command("taskkill", "/F", "/IM", "rdpclip.exe").Run()

	// Terminate active user connections by logging off remote users (forcefully close the session)
	// We run `query session` to find RDP-Tcp sessions and `logoff` them
	out, err := exec.Command("query", "session").Output()
	if err == nil {
		lines := strings.Split(string(out), "\n")
		for _, line := range lines {
			lowerLine := strings.ToLower(line)
			if strings.Contains(lowerLine, "rdp-tcp#") {
				// parse session ID
				fields := strings.Fields(line)
				for i, f := range fields {
					if strings.Contains(strings.ToLower(f), "rdp-tcp#") && i+2 < len(fields) {
						sessionID := fields[i+2]
						if sessionID != "" {
							runCmd("logoff", sessionID)
						}
						break
					}
				}
			}
		}
	}
}

func isolateNode(enable bool) {
	if enable {
		fmt.Println("Isolating Node...")

		// Parse serverURL to get just the IP or Host
		// e.g., http://193.3.100.207:8000/api/report -> 193.3.100.207
		serverIP := "10.0.0.50" // Fallback
		if strings.HasPrefix(serverURL, "http://") || strings.HasPrefix(serverURL, "https://") {
			parts := strings.Split(serverURL, "/")
			if len(parts) >= 3 {
				hostPort := parts[2]
				hostParts := strings.Split(hostPort, ":")
				serverIP = hostParts[0]
			}
		}

		// First clean up any old buggy rules if they exist
		runCmd("netsh", "advfirewall", "firewall", "delete", "rule", "name=BLOCK_ALL")
		runCmd("netsh", "advfirewall", "firewall", "delete", "rule", "name=BLOCK_ALL_OUT")

		// Force start the Windows Firewall service (MpsSvc) because the org keeps it disabled
		runCmd("sc", "config", "MpsSvc", "start=", "auto")
		runCmd("net", "start", "MpsSvc")

		runCmd("netsh", "advfirewall", "set", "allprofiles", "state", "on")

		// Change the default policy to block all inbound and outbound
		runCmd("netsh", "advfirewall", "set", "allprofiles", "firewallpolicy", "blockinbound,blockoutbound")

		// Explicitly allow orchestrator IP
		runCmd("netsh", "advfirewall", "firewall", "add", "rule", "name=ALLOW_ORCHESTRATOR", "dir=in", "action=allow", "remoteip="+serverIP)
		runCmd("netsh", "advfirewall", "firewall", "add", "rule", "name=ALLOW_ORCHESTRATOR_OUT", "dir=out", "action=allow", "remoteip="+serverIP)
	} else {
		fmt.Println("Removing Isolation...")

		// Restore default outbound policy (allowoutbound)
		runCmd("netsh", "advfirewall", "set", "allprofiles", "firewallpolicy", "blockinbound,allowoutbound")

		runCmd("netsh", "advfirewall", "firewall", "delete", "rule", "name=ALLOW_ORCHESTRATOR")
		runCmd("netsh", "advfirewall", "firewall", "delete", "rule", "name=ALLOW_ORCHESTRATOR_OUT")

		// Also clean up old buggy rules here just in case
		runCmd("netsh", "advfirewall", "firewall", "delete", "rule", "name=BLOCK_ALL")
		runCmd("netsh", "advfirewall", "firewall", "delete", "rule", "name=BLOCK_ALL_OUT")

		// Disable firewall explicitly to match org policy
		runCmd("netsh", "advfirewall", "set", "allprofiles", "state", "off")
	}
}

func reportInventory() {
	fmt.Println("Gathering App Inventory...")
	apps := getAppInventory()

	payload := map[string]interface{}{
		"mac_address": macAddr,
		"inventory":   apps,
	}

	jsonData, _ := json.Marshal(payload)
	url := strings.Replace(serverURL, "/report", "/inventory", 1)
	req, err := http.NewRequest("POST", url, bytes.NewBuffer(jsonData))
	if err != nil {
		fmt.Printf("reportInventory: failed to create request: %v\n", err)
		return
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Shared-Secret", SharedSecret)

	client := &http.Client{Timeout: 15 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		fmt.Printf("reportInventory: POST failed: %v\n", err)
		return
	}
	resp.Body.Close()
	if resp.StatusCode != 200 {
		fmt.Printf("reportInventory: server returned %d\n", resp.StatusCode)
	}
}

func getAppInventory() []map[string]string {
	var inventory []map[string]string
	paths := []string{
		`SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall`,
		`SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall`,
	}

	for _, path := range paths {
		cmd := exec.Command("powershell", "-NoProfile", "-ExecutionPolicy", "Bypass", "-Command",
			fmt.Sprintf("Get-ItemProperty HKLM:\\%s\\* -ErrorAction SilentlyContinue | Select-Object DisplayName, DisplayVersion, InstallDate | ConvertTo-Json -Compress", path))
		hideWindow(cmd)
		out, err := cmd.Output()
		if err != nil {
			continue
		}

		var results []map[string]string
		if err := json.Unmarshal(out, &results); err == nil {
			for _, res := range results {
				if res["DisplayName"] != "" {
					inventory = append(inventory, res)
				}
			}
		} else {
			var single map[string]string
			if err := json.Unmarshal(out, &single); err == nil {
				if single["DisplayName"] != "" {
					inventory = append(inventory, single)
				}
			}
		}
	}
	return inventory
}

// Helper to send a final status update before death
func sendOneShotStatus(statusMsg string) {
	fmt.Printf("Sending Last Breath Status: %s\n", statusMsg)
	report := currentState
	report.Status = statusMsg

	jsonData, _ := json.Marshal(report)
	req, _ := http.NewRequest("POST", serverURL, bytes.NewBuffer(jsonData))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Shared-Secret", SharedSecret)

	client := &http.Client{Timeout: 2 * time.Second}
	client.Do(req)
}

// --- Enforcer Logic ---

// Action 1: Block WPD (Phones)
func setWpdBlocked(block bool) {
	// WPD Devices (Phones, Media Players, etc)
	setRegistryPolicy(`Software\Policies\Microsoft\Windows\RemovableStorageDevices\{6AC27878-A6FA-4155-BA85-F98F491D4F33}`, block)
	setRegistryPolicy(`Software\Policies\Microsoft\Windows\RemovableStorageDevices\{F33FDC04-D1AC-4E8E-9A30-19BBD4B108AE}`, block)
}

func checkWpdBlocked() bool {
	return checkRegistryPolicy(`Software\Policies\Microsoft\Windows\RemovableStorageDevices\{6AC27878-A6FA-4155-BA85-F98F491D4F33}`)
}

// Action 2: Block Removable Disks (USB Keys)
func setRemovableBlocked(block bool) {
	// Removable Disks (Standard USB Flash Drives)
	setRegistryPolicy(`Software\Policies\Microsoft\Windows\RemovableStorageDevices\{53f5630d-b6bf-11d0-94f2-00a0c91efb8b}`, block)
}

func checkRemovableBlocked() bool {
	return checkRegistryPolicy(`Software\Policies\Microsoft\Windows\RemovableStorageDevices\{53f5630d-b6bf-11d0-94f2-00a0c91efb8b}`)
}

// setInternetBlocked and checkInternetBlocked REMOVED

func setRegistryPolicy(keyPath string, block bool) {
	// 1. Ensure parent "RemovableStorageDevices" exists
	// This appears to be the main failure point if the folder doesn't exist.
	parentPath := `Software\Policies\Microsoft\Windows\RemovableStorageDevices`
	if strings.HasPrefix(keyPath, parentPath) {
		kp, err := createKey(HKEY_LOCAL_MACHINE, parentPath)
		if err == nil {
			regCloseKey(kp)
		} else {
			fmt.Printf("Warning: Could not create parent key %s: %v\n", parentPath, err)
		}
	}

	k, err := createKey(HKEY_LOCAL_MACHINE, keyPath)
	if err != nil {
		fmt.Printf("Reg Error Create/Open (%s): %v\n", keyPath, err)
		return
	}
	defer regCloseKey(k)

	if block {
		setDWordValue(k, "Deny_Read", 1)
		setDWordValue(k, "Deny_Write", 1)
		fmt.Printf("Blocked: %s\n", keyPath)
	} else {
		deleteValue(k, "Deny_Read")
		deleteValue(k, "Deny_Write")
		fmt.Printf("Unblocked: %s\n", keyPath)
	}
}

func checkRegistryPolicy(keyPath string) bool {
	k, err := openKey(HKEY_LOCAL_MACHINE, keyPath, KEY_READ)
	if err != nil {
		return false
	}
	defer regCloseKey(k)

	val, err := getDWordValue(k, "Deny_Write")
	return err == nil && val == 1
}

func getRealOSVersion() string {
	k, err := openKey(HKEY_LOCAL_MACHINE, `SOFTWARE\Microsoft\Windows NT\CurrentVersion`, KEY_READ)
	if err != nil {
		return runtime.GOOS + " " + runtime.GOARCH
	}
	defer regCloseKey(k)

	productName, _ := getStringValue(k, "ProductName")
	currentBuild, _ := getStringValue(k, "CurrentBuild")

	// Fallback if registry fails
	if productName == "" {
		return runtime.GOOS
	}

	// Logic: Windows 11 keeps "Windows 10" in ProductName but has Build >= 22000
	// e.g. Build 22000, 22621, etc.
	if strings.Contains(productName, "Windows 10") {
		var buildNum int
		fmt.Sscanf(currentBuild, "%d", &buildNum)
		if buildNum >= 22000 {
			productName = strings.Replace(productName, "Windows 10", "Windows 11", 1)
		}
	}

	if currentBuild != "" {
		return fmt.Sprintf("%s (Build %s)", productName, currentBuild)
	}
	return productName
}

// Low-level wrappers

func createKey(hKey uintptr, path string) (uintptr, error) {
	var result uintptr
	var disposition uint32
	pathPtr, _ := syscall.UTF16PtrFromString(path)
	ret, _, _ := procRegCreateKeyExW.Call(
		hKey,
		uintptr(unsafe.Pointer(pathPtr)),
		0,
		0,
		0,
		uintptr(KEY_ALL_ACCESS),
		0,
		uintptr(unsafe.Pointer(&result)),
		uintptr(unsafe.Pointer(&disposition)),
	)
	if ret != 0 {
		return 0, fmt.Errorf("RegCreateKeyExW failed: %d", ret)
	}
	return result, nil
}

func openKey(hKey uintptr, path string, access uintptr) (uintptr, error) {
	var result uintptr
	pathPtr, _ := syscall.UTF16PtrFromString(path)
	ret, _, _ := procRegOpenKeyExW.Call(
		hKey,
		uintptr(unsafe.Pointer(pathPtr)),
		0,
		access,
		uintptr(unsafe.Pointer(&result)),
	)
	if ret != 0 {
		return 0, fmt.Errorf("RegOpenKeyExW failed: %d", ret)
	}
	return result, nil
}

func regCloseKey(hKey uintptr) {
	procRegCloseKey.Call(hKey)
}

func setDWordValue(hKey uintptr, name string, value uint32) error {
	namePtr, _ := syscall.UTF16PtrFromString(name)
	// Little endian
	var buf [4]byte
	buf[0] = byte(value)
	buf[1] = byte(value >> 8)
	buf[2] = byte(value >> 16)
	buf[3] = byte(value >> 24)

	ret, _, _ := procRegSetValueExW.Call(
		hKey,
		uintptr(unsafe.Pointer(namePtr)),
		0,
		uintptr(REG_DWORD),
		uintptr(unsafe.Pointer(&buf[0])),
		uintptr(4),
	)
	if ret != 0 {
		return fmt.Errorf("RegSetValueExW failed: %d", ret)
	}
	return nil
}

func setStringValue(hKey uintptr, name string, value string) error {
	namePtr, _ := syscall.UTF16PtrFromString(name)
	valSlice, _ := syscall.UTF16FromString(value)
	size := uintptr(len(valSlice) * 2)

	ret, _, _ := procRegSetValueExW.Call(
		hKey,
		uintptr(unsafe.Pointer(namePtr)),
		0,
		uintptr(REG_SZ),
		uintptr(unsafe.Pointer(&valSlice[0])),
		size,
	)
	if ret != 0 {
		return fmt.Errorf("RegSetValueExW failed: %d", ret)
	}
	return nil
}

func getDWordValue(hKey uintptr, name string) (uint32, error) {
	namePtr, _ := syscall.UTF16PtrFromString(name)
	var typ uint32
	var buf [4]byte
	size := uint32(4)

	ret, _, _ := procRegQueryValueExW.Call(
		hKey,
		uintptr(unsafe.Pointer(namePtr)),
		0,
		uintptr(unsafe.Pointer(&typ)),
		uintptr(unsafe.Pointer(&buf[0])),
		uintptr(unsafe.Pointer(&size)),
	)
	if ret != 0 {
		return 0, fmt.Errorf("RegQueryValueExW failed: %d", ret)
	}
	return uint32(buf[0]) | uint32(buf[1])<<8 | uint32(buf[2])<<16 | uint32(buf[3])<<24, nil
}

func getStringValue(hKey uintptr, name string) (string, error) {
	namePtr, _ := syscall.UTF16PtrFromString(name)
	var typ uint32
	var size uint32

	// Get size first
	ret, _, _ := procRegQueryValueExW.Call(
		hKey,
		uintptr(unsafe.Pointer(namePtr)),
		0,
		uintptr(unsafe.Pointer(&typ)),
		0,
		uintptr(unsafe.Pointer(&size)),
	)
	if ret != 0 && ret != 234 { // 234 = ERROR_MORE_DATA
		return "", fmt.Errorf("RegQueryValueExW failed: %d", ret)
	}

	if size == 0 {
		return "", nil
	}

	buf := make([]uint16, size/2)
	ret, _, _ = procRegQueryValueExW.Call(
		hKey,
		uintptr(unsafe.Pointer(namePtr)),
		0,
		uintptr(unsafe.Pointer(&typ)),
		uintptr(unsafe.Pointer(&buf[0])),
		uintptr(unsafe.Pointer(&size)),
	)
	if ret != 0 {
		return "", fmt.Errorf("RegQueryValueExW failed: %d", ret)
	}

	return syscall.UTF16ToString(buf), nil
}

func deleteValue(hKey uintptr, name string) error {
	namePtr, _ := syscall.UTF16PtrFromString(name)
	ret, _, _ := procRegDeleteValueW.Call(
		hKey,
		uintptr(unsafe.Pointer(namePtr)),
	)
	if ret != 0 {
		return fmt.Errorf("RegDeleteValueW failed: %d", ret)
	}
	return nil
}

func runCmd(name string, args ...string) error {
	cmd := exec.Command(name, args...)
	hideWindow(cmd)
	if err := cmd.Run(); err != nil {
		fmt.Printf("Command failed [%s %v]: %v\n", name, args, err)
		return err
	}
	return nil
}

func hideWindow(cmd *exec.Cmd) {
	cmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: true}
}

// Helper struct for JSON decoding from PowerShell
type NetworkAdapter struct {
	Name                 string `json:"Name"`
	InterfaceDescription string `json:"InterfaceDescription"`
}

func getAdapterDescriptions() map[string]string {
	// Run PowerShell to get Name -> Description mapping
	cmd := exec.Command("powershell", "-NoProfile", "-Command", "Get-NetAdapter | Select-Object Name, InterfaceDescription | ConvertTo-Json")
	hideWindow(cmd)
	out, err := cmd.Output()
	if err != nil {
		fmt.Printf("Error fetching adapters via PS: %v\n", err)
		return nil
	}

	// PowerShell ConvertTo-Json can return a single object or a list
	// We handle both by trying list first, then single
	descMap := make(map[string]string)

	// Try list
	var adapters []NetworkAdapter
	if err := json.Unmarshal(out, &adapters); err == nil {
		for _, a := range adapters {
			descMap[strings.ToLower(a.Name)] = strings.ToLower(a.InterfaceDescription)
		}
		return descMap
	}

	// Try single object (if only 1 adapter exists)
	var singleAdapter NetworkAdapter
	if err := json.Unmarshal(out, &singleAdapter); err == nil {
		descMap[strings.ToLower(singleAdapter.Name)] = strings.ToLower(singleAdapter.InterfaceDescription)
		return descMap
	}

	return nil
}

func getLocalIP() string {
	interfaces, err := net.Interfaces()
	if err != nil {
		return "0.0.0.0"
	}

	// 1. Get Hardware Descriptions via PowerShell
	descMap := getAdapterDescriptions()
	if descMap == nil {
		fmt.Println("Warning: Could not fetch adapter descriptions. Fallback to name-based logic.")
		descMap = make(map[string]string)
	}

	bestIP := "0.0.0.0"
	priority := -1

	for _, i := range interfaces {
		name := strings.ToLower(i.Name)
		description := descMap[name] // Might be empty if not found

		fmt.Printf("Interface: '%s' Desc: '%s' Status: %v\n", i.Name, description, i.Flags)

		// Exclude virtual/loopback by Name OR Description
		fullText := name + " " + description
		if strings.Contains(fullText, "virtual") ||
			strings.Contains(fullText, "v-ethernet") ||
			strings.Contains(fullText, "hyper-v") ||
			strings.Contains(fullText, "vmware") ||
			strings.Contains(fullText, "pseudo") ||
			strings.Contains(fullText, "loopback") {
			continue
		}

		if i.Flags&net.FlagUp == 0 || i.Flags&net.FlagLoopback != 0 {
			continue
		}

		// Score based on hardware name (Description)
		currentPriority := 0
		if strings.Contains(description, "realtek") || strings.Contains(description, "intel") ||
			strings.Contains(description, "pcie") || strings.Contains(description, "gbe") ||
			strings.Contains(description, "controller") {
			currentPriority = 3
		} else if strings.Contains(name, "ethernet") || strings.Contains(name, "local area connection") {
			currentPriority = 2
		} else if strings.Contains(name, "wi-fi") || strings.Contains(name, "wireless") {
			currentPriority = 1
		}

		addrs, err := i.Addrs()
		if err != nil {
			continue
		}

		for _, addr := range addrs {
			if ipnet, ok := addr.(*net.IPNet); ok && !ipnet.IP.IsLoopback() {
				v4 := ipnet.IP.To4()
				if v4 != nil && !v4.IsLinkLocalUnicast() {
					if currentPriority > priority {
						bestIP = v4.String()
						priority = currentPriority
						fmt.Printf(" -> New Best Candidate: %s (Priority %d)\n", bestIP, priority)
					}
				}
			}
		}
	}

	return bestIP
}

func getMacForIP(ip string) string {
	if ip == "0.0.0.0" || ip == "" {
		return "00:00:00:00:00:00"
	}

	interfaces, err := net.Interfaces()
	if err != nil {
		return "00:00:00:00:00:00"
	}

	for _, i := range interfaces {
		addrs, err := i.Addrs()
		if err != nil {
			continue
		}
		for _, addr := range addrs {
			if ipnet, ok := addr.(*net.IPNet); ok {
				if ipnet.IP.String() == ip {
					return i.HardwareAddr.String()
				}
			}
		}
	}

	return "00:00:00:00:00:00"
}

// Old function for compatibility if needed elsewhere
func getMacAddress() string {
	return getMacForIP(getLocalIP())
}

func getCPUUsage() int {
	// Simple one-shot via WMIC for load percentage
	cmd := exec.Command("wmic", "cpu", "get", "loadpercentage")
	hideWindow(cmd)
	out, err := cmd.Output()
	if err != nil {
		return 0
	}
	lines := strings.Split(string(out), "\n")
	if len(lines) > 1 {
		val := strings.TrimSpace(lines[1])
		var usage int
		fmt.Sscanf(val, "%d", &usage)
		return usage
	}
	return 0
}

func getRAMInfo() (string, int) {
	var ms memoryStatusEx
	ms.cbSize = uint32(unsafe.Sizeof(ms))
	ret, _, _ := procGlobalMemoryStatusEx.Call(uintptr(unsafe.Pointer(&ms)))
	if ret == 0 {
		return "0GB", 0
	}

	totalGB := float64(ms.ullTotalPhys) / (1024 * 1024 * 1024)
	usage := int(ms.dwMemoryLoad)

	return fmt.Sprintf("%.1fGB", totalGB), usage
}

func getUserName() string {
	return os.Getenv("USERNAME")
}
